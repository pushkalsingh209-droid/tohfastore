// app/api/razorpay-webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.event === "payment.captured") {
      const paymentEntity = body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const totalAmount = paymentEntity.amount / 100;
      
      // Capture custom customer data filled out in the drawer inputs
      const customerEmail = paymentEntity.email || "customer@example.com";
      const customerPhone = paymentEntity.contact || "9999999999";

      let orderItems = [];
      let customerName = "Premium Customer";
      
      try {
        const rawNotes = body.payload.order?.entity?.notes || body.payload.payment?.entity?.notes;
        if (rawNotes) {
          if (rawNotes.items) {
            orderItems = typeof rawNotes.items === "string" ? JSON.parse(rawNotes.items) : rawNotes.items;
          }
          if (rawNotes.customer_name) {
            customerName = rawNotes.customer_name;
          }
        }
      } catch (parseError) {
        console.error("Notes items parsing error fallback tracking route execution:", parseError);
      }

      // 1. Log directly to Supabase orders table with the updated details
      const { error: dbError } = await supabase
        .from("orders")
        .insert([
          {
            order_id: orderId,
            payment_id: paymentId,
            amount: totalAmount,
            customer_details: { email: customerEmail, contact: customerPhone, name: customerName },
            items: orderItems,
          }
        ]);

      if (dbError) throw new Error(`Supabase Exception: ${dbError.message}`);

      // 2. Format HTML Notification Email Alert Rows
      const itemRowsHtml = orderItems.map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
        </tr>
      `).join("");

      const mailOptions = {
        from: `"Tohfa Storefront Alerts" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAIL || "pushkalsingh209@gmail.com",
        subject: `🚨 New Luxury Brass Order Received! | ₹${totalAmount.toLocaleString("en-IN")}`,
        html: `
          <div style="font-family: serif; color: #292524; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7e5e4; border-radius: 8px; background-color: #faf9f6;">
            <h2 style="color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 10px;">Tohfa Order Dispatch Request</h2>
            <p>A new purchase has cleared successfully via the Razorpay Gateway network layer.</p>
            <h3 style="color: #444;">Customer Overview</h3>
            <p style="font-size: 14px; margin: 4px 0;"><strong>Customer Name:</strong> ${customerName}</p>
            <p style="font-size: 14px; margin: 4px 0;"><strong>Email Address:</strong> ${customerEmail}</p>
            <p style="font-size: 14px; margin: 4px 0;"><strong>WhatsApp/Mobile:</strong> ${customerPhone}</p>
            <p style="font-size: 14px; margin: 4px 0;"><strong>Transaction Token:</strong> ${paymentId}</p>
            <h3 style="color: #444; margin-top: 20px;">Artifacts Inventory Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #f5f5f4; text-align: left;">
                  <th style="padding: 8px; border-bottom: 2px solid #d6d3d1;">Item Title</th>
                  <th style="padding: 8px; border-bottom: 2px solid #d6d3d1; text-align: center;">Qty</th>
                  <th style="padding: 8px; border-bottom: 2px solid #d6d3d1; text-align: right;">Unit Valuation</th>
                </tr>
              </thead>
              <tbody>${itemRowsHtml}</tbody>
            </table>
            <div style="margin-top: 25px; text-align: right; font-size: 16px; font-weight: bold; color: #b45309;">
              Total Earnings Settled: ₹${totalAmount.toLocaleString("en-IN")}
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (e) {
        console.error("Mail dispatch skip:", e);
      }
    }

    return NextResponse.json({ status: "webhook_acknowledged" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// Category-specific FAQs to drive organic search intent and address common hesitations.
// Keyed by category name (matching products.category).

export interface CategoryFaqItem {
  question: string;
  answer: string;
}

export const CATEGORY_FAQS: Record<string, CategoryFaqItem[]> = {
  Idols: [
    {
      question: "What materials are the idols made from?",
      answer:
        "Our brass idols are hand-cast using traditional lost-wax casting with 100% pure brass or brass-like alloys. Each piece is individually finished and polished to highlight the natural patina and grain.",
    },
    {
      question: "How should I care for my brass idol?",
      answer:
        "Brass naturally oxidizes over time, developing a rich patina. To maintain shine, gently dust with a soft cloth. For a brighter finish, use a brass polish on a soft cloth and buff gently. Avoid harsh chemicals or abrasive scrubbing.",
    },
    {
      question: "Are these idols suitable for worship?",
      answer:
        "Yes, all our idols are crafted respectfully with worship and devotion in mind. They're ideal for home pujas, temple offerings, and spiritual spaces. Handle and display with reverence.",
    },
    {
      question: "How are these idols shipped without damage?",
      answer:
        "Each idol is carefully wrapped in bubble wrap and secured in a sturdy cardboard box with internal cushioning. We take great care in packing to ensure arrival in perfect condition.",
    },
    {
      question: "Can I get a custom-sized or personalized idol?",
      answer:
        "Our current collection features fixed sizes. For custom orders or large institutional commissions, please reach out through our Corporate Gifting page.",
    },
  ],
  Diyas: [
    {
      question: "What are these brass diyas used for?",
      answer:
        "Brass diyas are traditional Indian oil lamps used in religious rituals, pujas, festivals (especially Diwali), and as decorative home accents. The gentle flame creates a warm, spiritual ambiance.",
    },
    {
      question: "Can I use real oil and fire in these diyas?",
      answer:
        "Yes, our brass diyas are fully functional and designed for use with oil and wicks. We recommend pure ghee or traditional lamp oil for the best results. Always use responsibly and keep away from flammable materials.",
    },
    {
      question: "How do I clean my brass diyas?",
      answer:
        "Gently wipe with a soft, dry cloth to remove dust. For a polished finish, use a brass cleaner on a soft cloth and buff. If used with oil, let it cool and wipe gently. Avoid soaking in water.",
    },
    {
      question: "Are these diyas suitable for gifting?",
      answer:
        "Absolutely. Brass diyas are thoughtful, meaningful gifts for Diwali, housewarming, weddings, and spiritual occasions. Each piece comes beautifully packaged and makes a lasting keepsake.",
    },
  ],
  Lamps: [
    {
      question: "What lighting options do the lamps have?",
      answer:
        "Our collection includes traditional oil lamps (for ghee or oil wicks) and modern electric/LED versions. Check individual product listings for specific lighting details and voltage requirements.",
    },
    {
      question: "Can I use these lamps in a living room or bedroom?",
      answer:
        "Yes, our lamps serve dual purposes as both spiritual objects and functional home décor. Oil lamps create a warm, intimate ambiance; electric versions offer convenient everyday use.",
    },
    {
      question: "Are electric lamps available?",
      answer:
        "We offer select electric and LED lamp options. Check product descriptions for voltage, plug type, and wattage. All come with standard Indian specifications (220V AC).",
    },
  ],
  "Pocket Temples": [
    {
      question: "What is a pocket temple?",
      answer:
        "A pocket temple is a compact, portable shrine featuring one or more deity idols and a small prayer space. Designed for personal devotion, travel, or compact home altars, they're perfect for apartments or on-the-go worship.",
    },
    {
      question: "Can I travel with a pocket temple?",
      answer:
        "Yes, pocket temples are designed to be portable and lightweight. Perfect for travel, office desks, or smaller living spaces while maintaining a dedicated prayer space.",
    },
    {
      question: "How do I set up a pocket temple?",
      answer:
        "Most pocket temples come ready to display out of the box. Simply place on a shelf, altar, or designated space. You can add fresh flowers, oil lamps, or incense as desired.",
    },
  ],
  "Board Games": [
    {
      question: "Where do these board games originate?",
      answer:
        "Our curated selection includes both classic imported board games and artisanal handcrafted variants. Each game is chosen for quality, durability, and engaging gameplay suitable for families and gatherings.",
    },
    {
      question: "Are these games suitable for children?",
      answer:
        "Game suitability varies by title. Check individual product descriptions for age recommendations, player counts, and complexity levels. Most are suitable for ages 8+.",
    },
    {
      question: "Can I use these as gifts?",
      answer:
        "Board games make excellent gifts for game nights, family bonding, and entertainment. Perfect for housewarming, birthdays, or holiday gifting.",
    },
  ],
  "UV Resin Earrings": [
    {
      question: "What are UV resin earrings?",
      answer:
        "UV resin earrings are handcrafted jewelry pieces created using epoxy resin and cured with UV light. Each pair is unique with embedded elements like flowers, glitter, or metallic accents.",
    },
    {
      question: "How do I care for my UV resin earrings?",
      answer:
        "Keep them dry and away from prolonged direct sunlight to maintain color brilliance. Clean gently with a soft, damp cloth. Avoid harsh chemicals, perfume, and chlorine water.",
    },
    {
      question: "Are UV resin earrings durable?",
      answer:
        "Yes, UV resin is durable and long-lasting when properly cared for. They're resistant to scratches and maintain their shine for years with regular gentle cleaning.",
    },
    {
      question: "Are these hypoallergenic?",
      answer:
        "The resin itself is hypoallergenic. Earring posts vary by design. If you have sensitive ears, please check individual product details for post materials (stainless steel, surgical, etc.).",
    },
  ],
  // Keyed to the exact category name in Supabase ("Polyresin"); this was
  // "Polyresin Collectibles", which never matched, so the FAQ never rendered.
  Polyresin: [
    {
      question: "What is polyresin?",
      answer:
        "Polyresin is a durable synthetic material that mimics the appearance of stone, wood, or metal. It's lightweight, long-lasting, and ideal for detailed figurines and collectibles.",
    },
    {
      question: "How do I display and care for polyresin pieces?",
      answer:
        "Display in a cool, dry location away from direct sunlight to prevent fading. Dust gently with a soft, dry cloth. Avoid water, extreme heat, and sharp impacts.",
    },
    {
      question: "Are these collectible pieces valuable?",
      answer:
        "Our polyresin collectibles are valued for their craftsmanship, artistry, and uniqueness. They make wonderful display pieces and conversation starters in homes and offices.",
    },
  ],
  Lotas: [
    {
      question: "What is an Ashtlakshmi lota?",
      answer:
        "An Ashtlakshmi lota has the eight forms of Goddess Lakshmi worked into the vessel. It is used for holding water in puja, for the kalash at Griha Pravesh, and is a popular auspicious gift.",
    },
    {
      question: "How do I clean and polish a brass lota?",
      answer:
        "Rub with a paste of lemon juice and salt (or tamarind and water), rinse well and dry with a soft cloth. Brass takes on a warm patina with age and can always be polished back to a shine.",
    },
    {
      question: "Can I drink water from a brass lota?",
      answer:
        "Brass lotas are traditionally used in puja. For daily drinking, keep the inside clean and bright, and follow the care guidance for the specific piece you buy.",
    },
  ],
  Gifts: [
    {
      question: "Which brass gift suits a housewarming or wedding?",
      answer:
        "Radha Krishna, Lakshmi Ganesha Saraswati panels and Kamdhenu pieces are traditional auspicious choices for a new home or wedding. Our gift guides list ideas by occasion.",
    },
    {
      question: "Do you offer gifting in bulk?",
      answer:
        "Yes. For staff, client or wedding gifting in numbers, see our corporate gifting page or contact us on WhatsApp for bulk pricing.",
    },
  ],
  "Wall Hanging": [
    {
      question: "Where should I hang a Lakshmi Ganesha Saraswati wall hanging?",
      answer:
        "Traditionally near the entrance, in the living room, or on the puja wall, at about eye level. Choose a clean, uncluttered wall.",
    },
    {
      question: "How do I care for a brass wall hanging?",
      answer:
        "Dust with a soft dry cloth. To restore shine, wipe gently with a lemon-and-salt paste, rinse and dry thoroughly. Keep away from damp walls.",
    },
  ],
  "Pan Stands": [
    {
      question: "What is a pan stand photo frame?",
      answer:
        "A gold- or silver-plated photo frame cut in the traditional pan (betel leaf) shape, for keeping a favourite deity's photo on a shelf, altar or office desk.",
    },
    {
      question: "Does the photo come with the frame?",
      answer:
        "Please check the individual product page for what is included, or message us on WhatsApp before ordering.",
    },
  ],
  Misc: [
    {
      question: "What chess sets do you have?",
      answer:
        "Sleek modern aluminium sets and classic weighted brass sets. Each product page lists the size and finish.",
    },
    {
      question: "Are the brass chess pieces weighted?",
      answer:
        "Classic brass pieces are heavier than plastic or wood for a stable, premium feel. See the individual listing for dimensions and weight.",
    },
  ],
};

// Get FAQs for a specific category; returns empty array if category has no specific FAQs
export function getCategoryFaqs(category: string | null | undefined): CategoryFaqItem[] {
  if (!category) return [];
  return CATEGORY_FAQS[category] || [];
}

// app/context/ChatLabelSettingContext.tsx
// Shim: the implementation moved into BootstrapContext.tsx (#11) so the
// storefront config is read once server-side instead of this context
// firing GET /api/settings on mount. Existing
// `import { useChatLabels } from ".../ChatLabelSettingContext"` call sites
// keep working via this re-export.
export { useChatLabels } from "./BootstrapContext";

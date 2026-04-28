// Back-compat shim — the form has been renamed PublishMetadataForm so it
// can serve all post types (blueprint / blog / bounty). Existing imports
// continue to work.
export {
  PublishMetadataForm as PublishBlueprintForm,
  PublishMetadataForm,
  getPostTypeTheme,
} from "./PublishMetadataForm";
export type {
  PublishFormValues,
  AutoDetectedMeta,
  PostType,
} from "./PublishMetadataForm";
export { default } from "./PublishMetadataForm";

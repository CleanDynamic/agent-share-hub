import { useEffect } from "react";
import { useUploadPicker } from "@/contexts/UploadPickerContext";

/**
 * /upload route — no standalone page. Auto-opens the upload type picker modal.
 * Selecting a type navigates directly to the matching editor; dismissing
 * sends the user home (handled inside UploadPickerProvider).
 */
export default function UploadTypeSelector() {
  const { openUploadTypePicker } = useUploadPicker();
  useEffect(() => {
    openUploadTypePicker();
  }, [openUploadTypePicker]);
  return null;
}

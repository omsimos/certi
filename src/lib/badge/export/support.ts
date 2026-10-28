// Kept free of encoder imports so the menu can probe support without fetching them.

export const canExportMp4 = async (): Promise<boolean> => {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    // H.264 High level 5.1, the lowest level that covers 1080x1536.
    const { supported } = await VideoEncoder.isConfigSupported({
      codec: "avc1.640033",
      width: 1080,
      height: 1536,
    });
    return supported === true;
  } catch {
    return false;
  }
};

export const canExportWebp = async (): Promise<boolean> => {
  try {
    if (typeof OffscreenCanvas === "undefined") return false;
    const blob = await new OffscreenCanvas(2, 2).convertToBlob({ type: "image/webp" });
    return blob.type === "image/webp";
  } catch {
    return false;
  }
};

export const canExportGif = async (): Promise<boolean> => typeof OffscreenCanvas !== "undefined";

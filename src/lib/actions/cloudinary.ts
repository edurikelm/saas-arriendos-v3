"use server";

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(file: File, folder?: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: folder ?? "rentalpro/properties",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else if (result) resolve(result.secure_url);
          else reject(new Error("No result from Cloudinary"));
        }
      )
      .end(buffer);
  });
}

export async function deleteImage(url: string): Promise<void> {
  const publicId = extractPublicId(url);
  if (publicId) {
    await cloudinary.uploader.destroy(publicId);
  }
}

function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(.+)\./);
  return match ? match[1] : null;
}
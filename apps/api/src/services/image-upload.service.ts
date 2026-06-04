import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { ApiError } from "../errors/api-error";

const allowedImageTypes = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

export const uploadsRoot = path.resolve(process.cwd(), "uploads");
export const imageUploadRoot = path.join(uploadsRoot, "images");

function ensureImageUploadRoot() {
  fs.mkdirSync(imageUploadRoot, { recursive: true });
}

ensureImageUploadRoot();

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      ensureImageUploadRoot();
      callback(null, imageUploadRoot);
    },
    filename(_req, file, callback) {
      callback(null, `${crypto.randomUUID()}${allowedImageTypes.get(file.mimetype)}`);
    }
  }),
  limits: {
    files: 1,
    fields: 0
  },
  fileFilter(_req, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new ApiError(400, "Image must be PNG, JPEG, WebP, or GIF.", "INVALID_IMAGE_TYPE"));
    }
    return callback(null, true);
  }
});

export function imagePublicPath(file: Express.Multer.File) {
  return `/uploads/images/${file.filename}`;
}

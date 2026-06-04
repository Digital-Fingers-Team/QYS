import { Request, Response } from "express";
import { ApiError } from "../errors/api-error";
import { imagePublicPath } from "../services/image-upload.service";

export const mediaController = {
  uploadImage: async (req: Request, res: Response) => {
    if (!req.file) throw new ApiError(400, "Please choose an image to upload.", "IMAGE_REQUIRED");
    const path = imagePublicPath(req.file);
    const origin = `${req.protocol}://${req.get("host")}`;
    res.status(201).json({ path, url: `${origin}${path}` });
  }
};

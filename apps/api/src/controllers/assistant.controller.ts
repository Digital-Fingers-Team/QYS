import { Response } from "express";
import { assistantChat } from "../services/assistant.service";
import { AuthedRequest } from "../middleware/auth";

export const assistantController = {
  chat: async (req: AuthedRequest, res: Response) => {
    res.json(await assistantChat(req));
  }
};

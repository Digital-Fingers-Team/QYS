import { Router } from "express";
import {
  activitiesController,
  authController,
  centersController,
  challengesController,
  complaintsController,
  ideasController,
  reportsController,
  statsController,
  usersController
} from "../controllers";
import { auth, optionalAuth, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

router.post("/auth/register", asyncHandler(authController.register));
router.post("/auth/login", asyncHandler(authController.login));
router.get("/auth/me", auth, asyncHandler(authController.me));
router.patch("/auth/me", auth, asyncHandler(authController.updateMe));

router.get("/users", auth, requireAdmin, asyncHandler(usersController.list));
router.post("/users", auth, requireAdmin, asyncHandler(usersController.create));
router.patch("/users/:id", auth, requireAdmin, asyncHandler(usersController.update));
router.delete("/users/:id", auth, requireAdmin, asyncHandler(usersController.delete));

router.get("/centers", asyncHandler(centersController.list));
router.get("/centers/:id", asyncHandler(centersController.get));
router.post("/centers", auth, requireAdmin, asyncHandler(centersController.create));
router.patch("/centers/:id", auth, requireAdmin, asyncHandler(centersController.update));
router.delete("/centers/:id", auth, requireAdmin, asyncHandler(centersController.delete));

router.get("/challenges", optionalAuth, asyncHandler(challengesController.list));
router.get("/challenges/:id", optionalAuth, asyncHandler(challengesController.get));
router.post("/challenges", auth, requireAdmin, asyncHandler(challengesController.create));
router.patch("/challenges/:id", auth, requireAdmin, asyncHandler(challengesController.update));
router.delete("/challenges/:id", auth, requireAdmin, asyncHandler(challengesController.delete));
router.post("/challenges/:id/join", auth, asyncHandler(challengesController.join));

router.get("/ideas", asyncHandler(ideasController.list));
router.post("/ideas", auth, asyncHandler(ideasController.create));
router.post("/ideas/:id/vote", auth, asyncHandler(ideasController.vote));
router.patch("/ideas/:id/status", auth, requireAdmin, asyncHandler(ideasController.updateStatus));

router.get("/complaints", auth, asyncHandler(complaintsController.list));
router.post("/complaints", auth, asyncHandler(complaintsController.create));
router.patch("/complaints/:id/status", auth, requireAdmin, asyncHandler(complaintsController.updateStatus));

router.get("/reports", auth, requireAdmin, asyncHandler(reportsController.list));
router.get("/activities", auth, requireAdmin, asyncHandler(activitiesController.list));
router.get("/stats/admin", auth, requireAdmin, asyncHandler(statsController.admin));
router.get("/stats/me", auth, asyncHandler(statsController.me));

export default router;

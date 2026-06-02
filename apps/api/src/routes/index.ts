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
import { monthlyReportsController } from "../controllers/monthly-reports.controller";
import { managementRoles, reportRoles } from "../auth/rbac";
import { auth, optionalAuth, requireAdmin, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { authRateLimit, uploadRateLimit } from "../middleware/security";
import { excelUpload } from "../services/excel-upload.service";

const router = Router();

router.post("/auth/register", authRateLimit, asyncHandler(authController.register));
router.post("/auth/login", authRateLimit, asyncHandler(authController.login));
router.get("/auth/me", auth, asyncHandler(authController.me));
router.patch("/auth/me", auth, asyncHandler(authController.updateMe));
router.patch("/auth/password", auth, asyncHandler(authController.changePassword));

router.get("/users", auth, requireRole(...managementRoles), asyncHandler(usersController.list));
router.post("/users", auth, requireRole(...managementRoles), asyncHandler(usersController.create));
router.patch("/users/:id", auth, requireAdmin, asyncHandler(usersController.update));
router.patch("/users/:id/password", auth, requireAdmin, asyncHandler(usersController.resetPassword));
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

router.get("/reports", auth, requireRole(...reportRoles), asyncHandler(reportsController.list));
router.post("/reports", auth, requireRole(...reportRoles), asyncHandler(reportsController.create));
router.post("/monthly-reports/upload", auth, requireRole(...reportRoles), uploadRateLimit, excelUpload.single("file"), asyncHandler(monthlyReportsController.upload));
router.get("/monthly-reports", auth, requireRole(...reportRoles), asyncHandler(monthlyReportsController.list));
router.get("/monthly-reports/summary", auth, requireRole(...reportRoles), asyncHandler(monthlyReportsController.summary));
router.get("/monthly-reports/uploads", auth, requireRole(...reportRoles), asyncHandler(monthlyReportsController.uploads));
router.get("/monthly-reports/export", auth, requireAdmin, asyncHandler(monthlyReportsController.export));
router.get("/monthly-reports/template", auth, requireRole(...reportRoles), asyncHandler(monthlyReportsController.template));
router.get("/activities", auth, requireAdmin, asyncHandler(activitiesController.list));
router.get("/stats/admin", auth, requireAdmin, asyncHandler(statsController.admin));
router.get("/stats/me", auth, asyncHandler(statsController.me));

export default router;

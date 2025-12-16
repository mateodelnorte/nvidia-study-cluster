import { eq } from "drizzle-orm";
import { type Router, Router as createRouter } from "express";
import { randomUUID } from "node:crypto";
import { alertEvents, alertRules } from "../db/schema.js";
import { getDb } from "../lib/db.js";
import { createChildLogger } from "../lib/logger.js";
import { CreateAlertRuleSchema, UpdateAlertRuleSchema } from "../models/alerts.js";

const log = createChildLogger("routes:alerts");
const router: Router = createRouter();

// GET /api/alerts - List all alert rules
router.get("/", (_req, res) => {
	const db = getDb();
	const rules = db.select().from(alertRules).all();
	res.json(rules);
});

// GET /api/alerts/:id - Get single alert rule
router.get("/:id", (req, res) => {
	const db = getDb();
	const rule = db
		.select()
		.from(alertRules)
		.where(eq(alertRules.id, req.params.id))
		.get();

	if (!rule) {
		res.status(404).json({ error: "Alert rule not found" });
		return;
	}

	res.json(rule);
});

// POST /api/alerts - Create new alert rule
router.post("/", (req, res) => {
	try {
		const data = CreateAlertRuleSchema.parse(req.body);
		const now = Date.now();

		const rule = {
			id: randomUUID(),
			...data,
			createdAt: now,
			updatedAt: now,
		};

		const db = getDb();
		db.insert(alertRules).values(rule).run();

		log.info({ ruleId: rule.id, name: rule.name }, "Created alert rule");
		res.status(201).json(rule);
	} catch (err) {
		log.error({ err }, "Failed to create alert rule");
		res.status(400).json({ error: "Invalid alert rule data" });
	}
});

// PUT /api/alerts/:id - Update alert rule
router.put("/:id", (req, res) => {
	try {
		const data = UpdateAlertRuleSchema.parse(req.body);
		const db = getDb();

		const existing = db
			.select()
			.from(alertRules)
			.where(eq(alertRules.id, req.params.id))
			.get();

		if (!existing) {
			res.status(404).json({ error: "Alert rule not found" });
			return;
		}

		const updated = {
			...existing,
			...data,
			updatedAt: Date.now(),
		};

		db.update(alertRules)
			.set(updated)
			.where(eq(alertRules.id, req.params.id))
			.run();

		log.info({ ruleId: req.params.id }, "Updated alert rule");
		res.json(updated);
	} catch (err) {
		log.error({ err }, "Failed to update alert rule");
		res.status(400).json({ error: "Invalid alert rule data" });
	}
});

// DELETE /api/alerts/:id - Delete alert rule
router.delete("/:id", (req, res) => {
	const db = getDb();

	const existing = db
		.select()
		.from(alertRules)
		.where(eq(alertRules.id, req.params.id))
		.get();

	if (!existing) {
		res.status(404).json({ error: "Alert rule not found" });
		return;
	}

	db.delete(alertRules).where(eq(alertRules.id, req.params.id)).run();

	log.info({ ruleId: req.params.id }, "Deleted alert rule");
	res.status(204).send();
});

// GET /api/alerts/events - Alert firing history
router.get("/events/history", (req, res) => {
	const db = getDb();
	const limit = Math.min(Number(req.query.limit) || 100, 1000);

	const events = db
		.select()
		.from(alertEvents)
		.orderBy(alertEvents.firedAt)
		.limit(limit)
		.all();

	res.json(events);
});

export default router;

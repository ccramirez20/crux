ALTER TABLE "registrations" DROP CONSTRAINT "registrations_athlete_id_category_id_unique";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_deadline" date;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_athlete_id_event_id_unique" UNIQUE("athlete_id","event_id");
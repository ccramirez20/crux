ALTER TABLE "events" ADD COLUMN "date" date;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_document_id_unique" UNIQUE("document_id");



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "user_id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_history" (
    "id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "owner_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "date" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."listing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "text" NOT NULL,
    "seller_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "type" "text" NOT NULL,
    "price" numeric NOT NULL,
    "deposit" numeric,
    "rental_period" "text",
    "condition" "text" NOT NULL,
    "images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pickup_location" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "times_changed_hands" integer DEFAULT 1 NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "listings_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'reserved'::"text", 'sold'::"text", 'rented'::"text", 'paused'::"text"]))),
    CONSTRAINT "listings_type_check" CHECK (("type" = ANY (ARRAY['sale'::"text", 'rent'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "text" NOT NULL,
    "thread_id" "text" NOT NULL,
    "sender_id" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."needs" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "note" "text",
    "arrival_date" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."needs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rentals" (
    "id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "renter_id" "text" NOT NULL,
    "deposit" numeric NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "phase" "text" NOT NULL,
    "quote" "jsonb",
    "payment_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rentals_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['promptpay'::"text", 'card'::"text", 'wallet'::"text"]))),
    CONSTRAINT "rentals_phase_check" CHECK (("phase" = ANY (ARRAY['active'::"text", 'return-pending'::"text", 'released'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."rentals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "author_id" "text" NOT NULL,
    "author_name" "text" NOT NULL,
    "author_avatar" "text",
    "role" "text" NOT NULL,
    "rating" numeric NOT NULL,
    "comment" "text",
    "date" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_role_check" CHECK (("role" = ANY (ARRAY['buyer'::"text", 'seller'::"text", 'renter'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_participants" (
    "thread_id" "text" NOT NULL,
    "user_id" "text" NOT NULL
);


ALTER TABLE "public"."thread_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "avatar" "text",
    "program" "text",
    "batch" "text",
    "rating" numeric DEFAULT 0 NOT NULL,
    "reviews_count" integer DEFAULT 0 NOT NULL,
    "joined" timestamp with time zone DEFAULT "now"(),
    "kind" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_kind_check" CHECK (("kind" = ANY (ARRAY['student'::"text", 'shop'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "listing_id");



ALTER TABLE ONLY "public"."listing_history"
    ADD CONSTRAINT "listing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rentals"
    ADD CONSTRAINT "rentals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("thread_id", "user_id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_history"
    ADD CONSTRAINT "listing_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rentals"
    ADD CONSTRAINT "rentals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rentals"
    ADD CONSTRAINT "rentals_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can add participants" ON "public"."thread_participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create listing history" ON "public"."listing_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "author_id"));



CREATE POLICY "Authenticated users can create threads" ON "public"."threads" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read listing history" ON "public"."listing_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read messages" ON "public"."messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read needs" ON "public"."needs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read participants" ON "public"."thread_participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read profiles" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read rentals" ON "public"."rentals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read threads" ON "public"."threads" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update listing history" ON "public"."listing_history" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update participants" ON "public"."thread_participants" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = "author_id")) WITH CHECK ((("auth"."uid"())::"text" = "author_id"));



CREATE POLICY "Authenticated users can update threads" ON "public"."threads" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Listings are publicly readable" ON "public"."listings" FOR SELECT USING (true);



CREATE POLICY "Users can create their own favorites" ON "public"."favorites" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can create their own listings" ON "public"."listings" FOR INSERT TO "authenticated" WITH CHECK (("seller_id" = (( SELECT "auth"."uid"() AS "uid"))::"text"));



CREATE POLICY "Users can create their own needs" ON "public"."needs" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can create their own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "id"));



CREATE POLICY "Users can create their own rentals" ON "public"."rentals" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "renter_id"));



CREATE POLICY "Users can delete their own favorites" ON "public"."favorites" FOR DELETE TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can delete their own listings" ON "public"."listings" FOR DELETE TO "authenticated" USING (("seller_id" = (( SELECT "auth"."uid"() AS "uid"))::"text"));



CREATE POLICY "Users can read their favorites" ON "public"."favorites" FOR SELECT TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = "sender_id"));



CREATE POLICY "Users can update their messages" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = "sender_id")) WITH CHECK ((("auth"."uid"())::"text" = "sender_id"));



CREATE POLICY "Users can update their own listings" ON "public"."listings" FOR UPDATE TO "authenticated" USING (("seller_id" = (( SELECT "auth"."uid"() AS "uid"))::"text")) WITH CHECK (("seller_id" = (( SELECT "auth"."uid"() AS "uid"))::"text"));



CREATE POLICY "Users can update their own needs" ON "public"."needs" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = "user_id")) WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = "id")) WITH CHECK ((("auth"."uid"())::"text" = "id"));



CREATE POLICY "Users can update their own rentals" ON "public"."rentals" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = "renter_id")) WITH CHECK ((("auth"."uid"())::"text" = "renter_id"));



ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."needs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rentals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."listing_history" TO "anon";
GRANT ALL ON TABLE "public"."listing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_history" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."needs" TO "anon";
GRANT ALL ON TABLE "public"."needs" TO "authenticated";
GRANT ALL ON TABLE "public"."needs" TO "service_role";



GRANT ALL ON TABLE "public"."rentals" TO "anon";
GRANT ALL ON TABLE "public"."rentals" TO "authenticated";
GRANT ALL ON TABLE "public"."rentals" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."thread_participants" TO "anon";
GRANT ALL ON TABLE "public"."thread_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_participants" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

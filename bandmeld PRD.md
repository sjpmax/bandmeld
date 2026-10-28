# **Product Requirement Document (PRD): BandMeld**

**Version:** 1.0  
**Status:** Draft / Specification  
**Target Platform:** Responsive Web App (Next.js \+ Supabase) $\rightarrow$ Mobile App (React Native / Expo)

## **1\. Executive Summary & Vision**

### **1.1 Overview**

**BandMeld** is a multi-sided marketplace and collaboration platform built for the original, DIY, and local live music scene (indie, punk, metal, rock, country, hip-hop). It eliminates the chaotic manual back-and-forth of show booking by allowing individual band members to sync calendars, package genre-matched 3–4 act bills, pitch turnkey show packages to venues, and build accountability through a double-blind, 3-way post-show rating system.

### **1.2 Core Problem Statement**

> 1. **Internal Band Scheduling:** Band members rely on messy text chains and spreadsheets to figure out when everyone is available to play.  
> 2. **Multi-Act Bill Formation:** Venues hate booking individual acts one by one for original shows. However, bands struggle to coordinate availability with 2–3 other local support acts before reaching out to venues.  
> 3. **Venue Pitch Friction:** Venues receive hundreds of disorganized emails weekly. They want full, pre-packaged line-ups with verified attendance data and clean press kits.  
> 4. **Lack of Accountability:** Bands flake, stage handoffs drag on, and attendance numbers are routinely exaggerated.

### **1.3 Key Value Proposition**

> * **For Bands:** Easily build and aggregate 3–4 act bills on mutually open dates, pitch complete lineup packages to venues, and host a slick Press Kit (EPK).  
> * **For Venues:** Receive curated, genre-matched line-up packages on silver platters, post open slot calls, and inspect verified act reliability scores.  
> * **For Local Creatives (Photographers/Engineers):** Connect directly with gigging bands on confirmed show dates.

## **2\. Target User Personas**

| Persona | Key Needs & Pain Points | Primary Goals |
| :---- | :---- | :---- |
| **The Band Leader / Member** | Juggles 4–5 people's schedules, texts other local bands for dates, cold-emails busy venues. | Find open dates fast, assemble solid co-bills, pitch venues easily, showcase EPK. |
| **The DIY Venue / Talent Buyer** | Inundated with single-band cold emails, deals with flaky acts, wants simple booking packages. | Fill open calendar nights with full, genre-aligned bills that draw crowds and respect schedules. |
| **The Local Concert Photographer** | Relies on Instagram DMs or word-of-mouth to find bands playing local shows. | Get hired by bands booked on confirmed dates; showcase event portfolios. |

## **3\. Core Features & Functional Requirements**

\[ Member Calendars \] ──\> \[ BandMeld Open Calendar \]  
                                   │  
                                   ▼  
\[ Band A \] ── Sync Co-Acts ──\> \[ 3–4 Act Bill Package \]  
                                   │  
                    ┌──────────────┴──────────────┐  
                    ▼                             ▼  
       \[ Outbound Web Pitch Link \]     \[ Inbound Venue Board \]  
                    │                             │  
                    └──────────────┬──────────────┘  
                                   ▼  
                          \[ Show Executed \]  
                                   │  
                                   ▼  
                  \[ Double-Blind 3-Way Reviews \]

### **3.1 Module 1: Band Calendar & Member Availability Engine**

> * **Member Calendar Sync:** Individual members connect personal calendars (Google Calendar / Apple iCal API) or set manual availability blocks.  
> * **Consolidated Band Availability:** Automatically overlays member schedules to generate a single "Band Available" master calendar.  
> * **Holding / Seeking Gig Status:** Bands can toggle dates as "Actively Seeking Gigs" (visible to peer bands) or "Penciled In".

### **3.2 Module 2: EPK Builder & Band Profiles**

> * **Profile Assets:** High-res image download links, logo uploads, bio, stage tech rider (PDF/text), and social links.  
> * **Media Integrations:** Embedded Spotify tracks, Apple Music widgets, and YouTube video players.  
> * **Audience & Stats Display:** Self-reported average local draw, primary/secondary genre tags, and geographical home base.

### **3.3 Module 3: Bill Builder (Band-to-Band Matchmaking)**

> * **Co-Act Discovery:** Search peer bands by Genre, Home Radius, Open Dates, and Average Draw.  
> * **Draft Lineup Package:** Band A creates a "Show Bill Draft" for a target date (e.g., Nov 14th) and sends join invites to Band B, Band C, and Band D.  
> * **Bill Acceptance:** Invited bands accept or decline. Once all acts confirm, the bill locks into a **Venue Pitch Package**.  
> * **Equipment / Backline Sharing Matrix:** Tag which band provides drums, bass cabs, or PA to simplify load-in for everyone.

### **3.4 Module 4: Venue Pitching & Reverse Marketplace**

> * **Outbound Shareable Pitch Link:** Generates a clean, non-authenticated web page link containing all 3–4 band EPKs, combined music samples, total estimated draw, and tech requirements. Bands can email this directly to any venue booking agent.  
> * **Inbound Venue Board:** Venues post open calendar slots (e.g., *"Seeking 3 Country/Western acts for Fri, Nov 14"*). Pre-formed BandMeld bills can submit their pitch package in one click.  
> * **One-Click Venue Approval:** Booking agents review the pitch package and click **Approve** or **Decline**.

### **3.5 Module 5: Double-Blind 3-Way Rating System**

To prevent retaliatory ratings and local social drama, reviews are strictly regulated:

Show Ends ──\> 48-Hr Review Window Opens ──\> Double-Blind Submissions ──\> Ratings Unlocked

#### **Rating Dimensions:**

> 1. **Band $\rightarrow$ Band:** Stage handoff speed, punctuality, gear sharing respect, cross-promotion effort.  
> 2. **Venue $\rightarrow$ Band:** Draw size vs. promise, punctuality/load-in, professionalism, stage tear-down speed.  
> 3. **Band $\rightarrow$ Venue:** Sound quality, payout accuracy/honesty, hospitality, staff friendliness.

#### **Logic Rules:**

> * Triggered 2 hours post-event via email/app notification.  
> * 48-hour submission window.  
> * Reviews remain **locked and invisible** until both parties submit, OR until the 48-hour window expires.  
> * Includes a **Private Feedback** box (sent only to the recipient, never posted publicly).

### **3.6 Module 6: Local Creative Directory (Photographers & Crew)**

> * **Creative Profiles:** Photographers, audio engineers, and poster designers create profiles with portfolios and standard gig rates.  
> * **Gig Matching:** When a 3–4 act bill is confirmed, BandMeld presents available local photographers for that date: *"Need a photographer for your show at The Velvet Room on Nov 14?"*

## **4\. Technical Architecture & Stack**

### **4.1 Recommended Stack**

> * **Frontend (Web MVP):** Next.js (React), Tailwind CSS, Framer Motion.  
> * **Backend / Database:** **Supabase**  
  * *PostgreSQL:* Handles complex multi-table relationships (Users $\rightarrow$ Bands $\rightarrow$ Members $\rightarrow$ Bills $\rightarrow$ Venues $\rightarrow$ Ratings).  
  * *Row Level Security (RLS):* Ensures private calendar details and unreleased reviews are strictly permission-controlled.  
  * *Realtime Subscriptions:* Pushes instant notifications for bill invites and pitch approvals.  
  * *Storage:* Hosts band press photos, tech riders, and photographer portfolios.  
> * **Mobile (Phase 2):** React Native / Expo (reusing \~80% of backend and logic code).

## **5\. Phased Roadmap**

Phase 1: Trojan Horse (Months 1–2)  
├── Member Calendar Aggregation Engine  
├── Band EPK Builder with Spotify/YouTube Embeds  
└── Basic Band Profiles & Shareable Web Links

Phase 2: Network Building (Months 3–4)  
├── Band-to-Band Bill Builder (3–4 Act Lineup Bundling)  
├── Local Photographer Directory & Gig Tagging  
└── Double-Blind 3-Way Rating System Engine

Phase 3: Venue Marketplace (Months 5–6)  
├── Shareable Venue Pitch Pages (No-login view for venues)  
├── Inbound Venue Open Slot Board  
└── Verified Performance Metrics & Draw Stats

Phase 4: Mobile & Monetization (Phase 2 App)  
├── React Native iOS/Android Release  
└── Escrow Payout Splits & Door Guarantee Deposits

## **6\. Cold-Start Strategy & Launch Tactics**

> 1. **Band-First Utility:** Don't wait for venues to join. Build the internal calendar sync and EPK builder so bands use BandMeld purely to organize themselves and pitch venues via standard email.  
> 2. **Scene Connectors:** Onboard 5–10 key DIY show organizers per target city. Their adoption naturally pulls 20–40 secondary bands into the ecosystem to fill co-bills.  
> 3. **Zero-Friction Venue Onboarding:** Booking agents do not need an account to review a BandMeld pitch link. They only register when they accept a show package.
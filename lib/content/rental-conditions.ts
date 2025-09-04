//Needs careful review
// General Rental Conditions — structured to mirror competitor clauses (1–14)
// Content is original and AMR-specific; FILL_ME_* placeholders flag items you must confirm before launch.

import type { LegalLink, LegalSection } from "@/lib/content/legal";
import { LEGAL_LINKS } from "@/lib/content/legal";

export type RentalConditionsDoc = {
  id: "rental-conditions";
  title: string;
  lastUpdated: string; // ISO date
  intro?: string;
  sections: LegalSection[];
  links?: LegalLink[];
};

export const RENTAL_CONDITIONS: RentalConditionsDoc = {
  id: "rental-conditions",
  title: "General Rental Conditions",
  lastUpdated: "2025-09-02",
  intro:
    "These conditions govern the rental of equipment and accessories. By confirming a booking, you agree to these terms.",
  sections: [
    // Clause 1 — Object
    {
      id: "clause-1-object",
      title: "Clause 1 — Object",
      body: [
        "These conditions cover rentals of equipment without operator and respective accessories, from AMR’s rental fleet.",
      ],
    },

    // Clause 2 — Lessor obligations (AMR)
    {
      id: "clause-2-lessor-obligations",
      title: "Clause 2 — Lessor Obligations (AMR)",
      body: [
        "Deliver equipment in good working order and condition.",
        "Provide maintenance and assistance according to the agreement.",
        "Inform and advise the Customer on proper use and safety.",
        "Maintain legally required insurance policies where applicable.",
      ],
    },

    // Clause 3 — Lessee obligations (Customer)
    {
      id: "clause-3-lessee-obligations",
      title: "Clause 3 — Lessee Obligations (Customer)",
      body: [
        "Keep the equipment in good condition and use it carefully, respecting safety rules and manufacturer instructions.",
        "Pay invoices on time, even if temporarily unable to use the equipment for reasons not attributable to AMR.",
        "Use the equipment at the agreed site and notify AMR in writing before changing the site or the nature of work.",
        "Do not sublet or transfer the equipment to third parties unless expressly authorized.",
        "Ensure operation by competent and properly trained personnel and comply with safety rules at all times.",
        "Collect and return equipment at AMR’s premises unless otherwise agreed; transport is at Customer’s cost and risk unless specified.",
        "Protect the equipment outside working hours against theft, vandalism, adverse weather, fire/explosion risk, flooding or terrain hazards.",
        "Bear any fines or penalties arising from use and notify AMR within 24 hours if they occur.",
        "Accept the use of GPS/telematics on the equipment for security and fleet management (where installed).",
        "Ensure timely and safe handover for delivery and collection.",
        "Do not add non-approved accessories without AMR’s written consent.",
      ],
    },

    // Clause 4 — Proposal and award
    {
      id: "clause-4-proposal-award",
      title: "Clause 4 — Proposal and Award",
      body: [
        "Awarding a proposal implies reading and accepting these General Conditions.",
        "AMR will provide relevant information during negotiation, including a quotation.",
        "The Customer will provide relevant information (e.g., if road-registered equipment is required for public-road use).",
        "Proposal award must be received by FILL_ME_CUTOFF_TIME on the business day prior to start, unless otherwise agreed.",
        "Availability is confirmed only after award; delivery on the agreed date may be affected by force majeure or sudden unavailability.",
      ],
    },

    // Clause 5 — Term
    {
      id: "clause-5-term",
      title: "Clause 5 — Term",
      body: [
        "The rental period stated in the Particular Conditions is essential; equipment must be returned on expiry.",
        "The period is counted in consecutive days, including delivery and return days.",
        "Extensions must be requested by the Customer before the end date (cutoff: FILL_ME_EXTENSION_CUTOFF) and require AMR’s acceptance.",
        "Early return is possible; fees may apply according to the price list or agreed rate (e.g., FILL_ME_EARLY_RETURN_FEE%).",
        "Lack of return does not imply automatic extension; obligations remain, including safekeeping duties.",
        "In case of incident/fault attributable to the Customer, the contract may remain open until investigations/repairs or settlement.",
      ],
    },

    // Clause 6 — Price
    {
      id: "clause-6-price",
      title: "Clause 6 — Price",
      body: [
        "Price depends on equipment type, rental period, site, and work profile.",
        "Base price excludes: operator, tires/punctures, fuel/energy, consumables, cleaning, preservation, and transport (unless agreed).",
        "AMR may require a security deposit to cover additional charges (e.g., tolls, fines, extra days, unplanned transport, fuel).",
        "Operator, if contracted, is billed at €350/day (MVP rule).",
      ],
    },

    // Clause 7 — Billing and payment
    {
      id: "clause-7-billing-payment",
      title: "Clause 7 — Billing and Payment",
      body: [
        "Payment terms are as stated in the Particular Conditions or at proposal award; deposit is due to confirm the booking.",
        "Failure to pay may lead to immediate termination and interest at the legal rate from due date until full payment.",
        "If the Customer requires purchase order references on invoices, those must be provided at award and accepted by AMR.",
        "Additional Customer conditions are only valid if confirmed in writing by AMR.",
        "Place of payment: FILL_ME_PAYMENT_LOCATION (e.g., AMR’s registered office).",
      ],
    },

    // Clause 8 — Delivery, return, and transport
    {
      id: "clause-8-delivery-return-transport",
      title: "Clause 8 — Delivery, Return, and Transport",
      body: [
        "Transport, delivery, and return are the Customer’s responsibility and cost unless otherwise agreed.",
        "Customer (or representative) must be present at delivery and return.",
        "Any public-road operations requiring permits/police presence are the Customer’s responsibility and cost.",
        "AMR may refuse transport if the Customer’s vehicle is inadequate.",
        "Return at AMR’s site by FILL_ME_RETURN_TIME on the last contracted day unless otherwise agreed; delays may incur charges.",
        "If the contract ends on a non-business day, return occurs by FILL_ME_NEXT_BUSINESS_TIME on the next business day.",
        "AMR may offer transport services on request; scheduling is the Customer’s responsibility.",
        "When AMR transport is contracted, pickup must be requested in writing by FILL_ME_TRANSPORT_REQUEST_CUTOFF to schedule.",
        "For each day of delay in return or pickup due to Customer reasons, the daily rental rate may be charged plus a surcharge (e.g., FILL_ME_DELAY_SURCHARGE%).",
        "The Customer must ensure access conditions for loading/unloading; additional costs may apply if conditions are not met.",
      ],
    },

    // Clause 9 — Fuel and batteries
    {
      id: "clause-9-fuel-batteries",
      title: "Clause 9 — Fuel and Batteries",
      body: [
        "Unless agreed, equipment is delivered with sufficient fuel/charge for loading/unloading and must be returned equivalently.",
        "If not returned accordingly, AMR may charge refueling/recharging per the current service table.",
        "The Customer must use suitable fuel/energy and bears costs for decontamination due to misuse.",
      ],
    },

    // Clause 10 — Work periods
    {
      id: "clause-10-work-periods",
      title: "Clause 10 — Work Periods",
      body: [
        "Rental assumes an average use of 8 hours/day unless otherwise agreed; excess usage may be charged per tariff.",
        "For road-mounted platforms or similar, daily travel distances may be limited; excess may be charged per tariff.",
      ],
    },

    // Clause 11 — Maintenance, breakdowns, repairs
    {
      id: "clause-11-maintenance-breakdowns",
      title: "Clause 11 — Maintenance, Breakdowns, and Repairs",
      body: [
        "Customer responsibilities include consequences of accidents with Customer responsibility, irregular use, and abnormal wear.",
        "Customer bears costs of repairs, call-outs, and downtime when attributable to Customer misuse or negligence.",
        "Customer must perform daily checks per manufacturer/AMR instructions and allow access for scheduled maintenance (minimum windows may apply).",
        "In case of fault, stop the equipment immediately and notify AMR; unjustified assistance requests may be charged.",
        "Customer must immediately report incidents and cooperate with authorities/insurers; administrative handling fees may apply where AMR’s automotive liability policy is engaged.",
        "Repairs or alterations require AMR’s prior written authorization.",
        "AMR will perform scheduled maintenance and provide assistance during normal hours; if repair is not possible within a reasonable time (e.g., 24h), AMR will attempt replacement where feasible.",
        "AMR is not liable for lost profit or consequential damage due to equipment downtime.",
      ],
    },

    // Clause 12 — Insurance
    {
      id: "clause-12-insurance",
      title: "Clause 12 — Insurance",
      body: [
        "AMR maintains legally required third-party liability where applicable; details provided upon request.",
        "Customer must maintain coverage for damage to the equipment during the rental or may request AMR-managed coverage if available.",
        "Optional coverages may be offered (e.g., hull/damage cover, road-use cover) with premiums stated in writing.",
        "Deductibles/excess and minimum charges apply and will be stated in writing (e.g., FILL_ME_EXCESS_% with minimum FILL_ME_EXCESS_MIN).",
        "If optional coverage is not contracted or conditions are not met, the Customer is responsible for damage under Clause 11.",
        "Customer must comply with insurer obligations; otherwise, the Customer bears resulting losses to AMR.",
        "Customer must maintain operational liability cover for work performed using the equipment and is liable for third-party damage during operation.",
      ],
    },

    // Clause 13 — Breach and termination
    {
      id: "clause-13-breach-termination",
      title: "Clause 13 — Breach and Termination",
      body: [
        "AMR may terminate for breach (e.g., non-payment, failure to request pickup/return, misuse, or safety issues).",
        "Amounts due for the remaining initial term may still be payable depending on the reason for termination.",
        "Upon termination, AMR may immobilize and recover the equipment without formalities; the Customer bears related costs.",
        "AMR is not liable for indirect or consequential damages arising from termination per this clause.",
        "If the Customer cancels within the last 24 hours before effectiveness, AMR may charge cancellation fees.",
      ],
    },

    // Clause 14 — Domicile and disputes
    {
      id: "clause-14-domicile-disputes",
      title: "Clause 14 — Domicile and Disputes",
      body: [
        "The addresses stated in the Particular Conditions are chosen domiciles for service in case of dispute.",
        "Portuguese law governs these conditions. The competent courts or arbitration centers will be those indicated in the Particular Conditions (e.g., Comarca de FILL_ME_REGION).",
        "Consumers can also use the official Portuguese electronic complaints book (see link below).",
      ],
    },

    // Contacts (appendix-style)
    {
      id: "contacts",
      title: "Contacts",
      body: [
        "Company: Algarve Machinery Rental",
        "Address: Barranco da Vaca, Aljezur, Portugal",
        "Email: support@amr-rentals.com",
        "Phone: FILL_ME_PHONE",
      ],
    },
  ],
  links: [
    LEGAL_LINKS.complaintsBook,
    // Optional: add a final static PDF link once generated:
    // { label: "Download PDF", href: "/docs/general-rental-conditions.pdf" },
  ],
};

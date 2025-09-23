// General Rental Conditions — production-safe, aligned with AMR business rules.
// Content is original and AMR-specific. Placeholders removed, wording matches LEGAL_TERMS.

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
  lastUpdated: "2025-09-17",
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
        "Collect and return equipment at AMR’s premises unless otherwise agreed; transport is at the Customer’s cost and risk unless specified.",
        "Protect the equipment outside working hours against theft, vandalism, adverse weather, fire or explosion risk, flooding, or terrain hazards.",
        "Bear any fines or penalties arising from use and notify AMR within 24 hours if they occur.",
        "Accept the use of GPS or telematics on the equipment for security and fleet management where installed.",
        "Ensure timely and safe handover for delivery and collection.",
        "Do not add non-approved accessories without AMR’s written consent.",
      ],
    },

    // Clause 4 — Bookings and confirmation
    {
      id: "clause-4-bookings-confirmation",
      title: "Clause 4 — Bookings and Confirmation",
      body: [
        "Bookings are made online, subject to availability. A booking is confirmed when the full rental amount is successfully paid at checkout.",
        "During checkout we may place a short hold on selected dates. If payment is not completed within the stated window, the hold expires and dates may become available to others.",
        "The Customer must provide the job site address and access notes when delivery or pickup is selected.",
      ],
    },

    // Clause 5 — Term
    {
      id: "clause-5-term",
      title: "Clause 5 — Term",
      body: [
        "The rental period stated in the Particular Conditions is essential. Equipment must be returned on expiry.",
        "The period is counted in consecutive calendar days, including delivery and return days.",
        "Extensions must be requested before the end date and require AMR’s acceptance. Rates for the extended period may differ.",
        "Early return is possible. Fees may apply according to the agreed rate or price list.",
        "Lack of return does not imply automatic extension. Obligations remain, including safekeeping duties.",
      ],
    },

    // Clause 6 — Price
    {
      id: "clause-6-price",
      title: "Clause 6 — Price",
      body: [
        "Price depends on equipment type, rental period, site, and work profile.",
        "Base price excludes operator, tires or punctures, fuel or energy, consumables, cleaning, preservation, and transport unless otherwise agreed.",
        "AMR may require a refundable security deposit to cover additional charges such as tolls, fines, extra days, unplanned transport, or fuel.",
        "If an operator is contracted, it is billed at €350 per day.",
      ],
    },

    // Clause 7 — Billing and payment
    {
      id: "clause-7-billing-payment",
      title: "Clause 7 — Billing and Payment",
      body: [
        "The full rental amount plus VAT is paid online at checkout via Stripe. The price summary shows amounts before VAT and the total with VAT.",
        "A refundable security deposit is collected at handover, either when you collect from our warehouse or when we deliver to your site. The deposit can be paid by card or cash.",
        "The deposit is refunded after the machine is returned and a quick inspection confirms no damage, loss, or extra charges. If paid by card we initiate the refund promptly; timing depends on your bank or card issuer.",
        "Additional charges that arise during or after the rental (for example, extra days, cleaning, refuelling, damage, or transport adjustments) are invoiced and payable upon receipt. Late payment may accrue interest at the legal rate from due date until full payment.",
        "If the Customer requires purchase order references on invoices, those must be provided at booking and accepted by AMR. Any additional Customer terms are only valid if confirmed in writing by AMR.",
      ],
    },

    // Clause 8 — Delivery, return, and transport
    {
      id: "clause-8-delivery-return-transport",
      title: "Clause 8 — Delivery, Return, and Transport",
      body: [
        "Transport, delivery, and return are the Customer’s responsibility and cost unless otherwise agreed.",
        "The Customer or an authorised representative must be present at delivery and return.",
        "Any public-road operations requiring permits or police presence are the Customer’s responsibility and cost.",
        "AMR may refuse transport if the Customer’s vehicle is inadequate or unsafe.",
        "Return at AMR’s warehouse must occur by the agreed time on the last contracted day unless otherwise agreed. If the end date falls on a non-business day, return occurs on the next business day at opening time.",
        "When AMR transport is contracted, pickup must be requested with reasonable notice so scheduling can be arranged.",
        "For each day of delay in return or in enabling pickup for reasons attributable to the Customer, the daily rental rate may be charged for the additional day, together with any associated costs.",
        "The Customer must ensure safe access conditions for loading and unloading. Additional costs may apply if conditions are not met.",
      ],
    },

    // Clause 9 — Fuel and batteries
    {
      id: "clause-9-fuel-batteries",
      title: "Clause 9 — Fuel and Batteries",
      body: [
        "Unless agreed, equipment is delivered with sufficient fuel or charge for loading and unloading and must be returned equivalently.",
        "If not returned accordingly, AMR may charge refuelling or recharging per the current service table.",
        "The Customer must use suitable fuel or energy and bears costs for decontamination due to misuse.",
      ],
    },

    // Clause 10 — Work periods
    {
      id: "clause-10-work-periods",
      title: "Clause 10 — Work Periods",
      body: [
        "Rental assumes an average use of 8 hours per day unless otherwise agreed. Excess usage may be charged per tariff.",
        "For road-mounted platforms or similar, daily travel distances may be limited. Excess may be charged per tariff.",
      ],
    },

    // Clause 11 — Maintenance, breakdowns, repairs
    {
      id: "clause-11-maintenance-breakdowns",
      title: "Clause 11 — Maintenance, Breakdowns, and Repairs",
      body: [
        "Customer responsibilities include consequences of accidents with Customer responsibility, irregular use, and abnormal wear.",
        "Customer bears costs of repairs, call-outs, and downtime when attributable to misuse or negligence.",
        "Customer must perform daily checks per manufacturer or AMR instructions and allow access for scheduled maintenance.",
        "In case of fault, stop the equipment immediately and notify AMR. Unjustified assistance requests may be charged.",
        "Customer must report incidents promptly and cooperate with authorities or insurers. Administrative handling fees may apply where AMR’s automotive liability policy is engaged.",
        "Repairs or alterations require AMR’s prior written authorization.",
        "AMR will perform scheduled maintenance and provide assistance during normal hours. If repair is not possible within a reasonable time, AMR will attempt replacement where feasible.",
        "AMR is not liable for lost profit or consequential damage due to equipment downtime.",
      ],
    },

    // Clause 12 — Insurance
    {
      id: "clause-12-insurance",
      title: "Clause 12 — Insurance",
      body: [
        "AMR maintains legally required third-party liability where applicable. Details are available on request.",
        "The Customer must maintain coverage for damage to the equipment during the rental or may request AMR-managed coverage if available.",
        "Optional coverages, deductibles, and minimum charges are stated in writing when contracted.",
        "If optional coverage is not contracted or conditions are not met, the Customer is responsible for damage under Clause 11.",
        "The Customer must maintain operational liability cover for work performed using the equipment and is liable for third-party damage during operation.",
      ],
    },

    // Clause 13 — Breach and termination
    {
      id: "clause-13-breach-termination",
      title: "Clause 13 — Breach and Termination",
      body: [
        "AMR may terminate for breach, including non-payment, failure to request pickup or return, misuse, or safety issues.",
        "Amounts due for the remaining initial term may still be payable depending on the reason for termination.",
        "Upon termination, AMR may immobilize and recover the equipment. The Customer bears related costs.",
        "AMR is not liable for indirect or consequential damages arising from termination under this clause.",
        "If the Customer cancels within the last 24 hours before effectiveness, AMR may charge cancellation fees.",
      ],
    },

    // Clause 14 — Domicile and disputes
    {
      id: "clause-14-domicile-disputes",
      title: "Clause 14 — Domicile and Disputes",
      body: [
        "The addresses stated in the Particular Conditions are chosen domiciles for service in case of dispute.",
        "Portuguese law governs these conditions. The courts of Braga have jurisdiction, without prejudice to mandatory rules that provide otherwise.",
        "Consumers can also use the official Portuguese electronic complaints book (see link below).",
      ],
    },

    // Contacts (appendix-style)
    {
      id: "contacts",
      title: "Contacts",
      body: [
        "Company: Algarve Machinery Rental",
        "Registered address: Avenida da Liberdade, Centro Comercial Granjinhos, Loja 446, 4710-249, Braga, Portugal",
        "Warehouse: Barranco da Vaca, 8670-116, Aljezur, Portugal",
        "Warehouse hours: Mo–Fr 09:00–17:00",
        "Email: support@amr-rentals.com",
      ],
    },
  ],
  links: [
    LEGAL_LINKS.complaintsBook,
    // Optional: add a final static PDF link once generated:
    // { label: "Download PDF", href: "/docs/general-rental-conditions.pdf" },
  ],
};

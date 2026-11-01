import type { PolicyDocumentDto } from '../../modules/policy/policy.dto.js';

export const POLICY_SEED_DOCUMENTS: PolicyDocumentDto[] = [
  {
    schemeName: 'PM KISAN Samman Nidhi',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://pmkisan.gov.in',
    content: `PM KISAN (Pradhan Mantri Kisan Samman Nidhi) is a central sector scheme that provides income support to all landholding farmer families across India. The benefit is Rs 6,000 per year, paid as three equal quarterly installments of Rs 2,000 directly into the Aadhaar-seeded bank account of the farmer. Every family owning cultivable land as per land records is eligible; institutional landholders, serving or retired government employees, and income-tax payers in the previous year are excluded. How to apply: register on the PM KISAN portal (pmkisan.gov.in) through the CSC or farmer corner, grameen farmers may self-register without Aadhaar-based OTP in state-offline mode, verify name as per land records with the Patwari, and track installment status in the Beneficiary Status section. Installments are released on fixed dates announced by the Government of India. Helpline: 155261 or 011-23378340. The scheme has no application deadline and enrollment is open throughout the year. Exclusion covers farmers who pay income tax or whose family members are constitutional post holders.`,
  },
  {
    schemeName: 'Ayushman Bharat PM-JAY',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://pmjay.gov.in',
    content: `Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY) is the world's largest government-funded health assurance scheme. It provides a health cover of Rs 5 lakh per family per year for secondary and tertiary care hospitalization, with no cap on family size, age, or gender, and covers pre-existing conditions from day one. Eligibility is based on the Socio-Economic Caste Census 2011 deprivation criteria such as rural households without adult earning members, landless labourers, and manual scavengers; in urban areas, slum-dweller occupational categories qualify. Private hospitals empanelled under PM-JAY as well as public hospitals treat beneficiaries at zero cost, including surgery from listed packages. How to apply: check eligibility through mobile number on the PM-JAY portal (pmjay.gov.in) or the Ayushman app, verify ration card or Aadhaar details at the nearest Ayushman Mitra desk (CSC/VLE), receive the Ayushman card, then get treated at any empanelled hospital. Helpline: 14555 or 1800-111-565. There is no deadline; enrollment is continuous. The e-card is valid across all states implementing PM-JAY, making treatment portable anywhere in India.`,
  },
  {
    schemeName: 'Pradhan Mantri Awas Yojana',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://pmayg.nic.in',
    content: `Pradhan Mantri Awas Yojana (PMAY) aims to provide pucca houses with basic amenities to all homeless families and families living in kutcha or dilapidated houses. For rural India (PMAY-G) the assistance ceiling is Rs 1.20 lakh in plain areas and Rs 1.30 lakh in hilly states, difficult terrain, or Integrated Action Plan districts, with an additional unskilled 90 days of MGNREGA labour and Rs 12,000 for a toilet under Swachh Bharat. Urban beneficiaries (PMAY-U) receive credit-linked interest subsidy: Economically Weaker Section and Low Income Group get up to Rs 6.5 percent subsidy on loans up to Rs 6 lakh as part of the Credit Linked Subsidy Scheme. Eligibility requires the household not to already own a pucca house anywhere in India and to fall in the EWS, LIG, or MIG income bands as documented. How to apply: PMAY-G lists beneficiaries through the Awaas+ survey and the Gram Sabha, tracked on pmayg.nic.in; PMAY-U applications go through the Common Service Centres or the pmay-urban portal using Aadhaar, income certificate, and bank details. Helpline: 1800-11-3377 (urban) or contact the block-level BDO for rural. Deadlines follow the annual demand survey cycles announced by the state rural development department.`,
  },
  {
    schemeName: 'Pradhan Mantri Jan Dhan Yojana',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://pmjdy.gov.in',
    content: `Pradhan Mantri Jan Dhan Yojana (PMJDY) is a national financial inclusion mission ensuring every family has a basic zero-balance bank account with least paperwork. Account holders get a RuPay debit card with in-built accidental insurance cover of Rs 2 lakh and an overdraft facility of Rs 10,000 on satisfactory transaction history. PMJDY accounts earn the same interest as savings accounts, receive direct benefit transfers for schemes such as PM KISAN, LPG subsidy, and MGNREGA wages, and support the Jeevan Jyoti Bima and Surksha Bima micro-insurance enrollments. Any Indian citizen aged 10 years or above without a bank account is eligible; minors operate with guardian consent. How to apply: walk into any bank branch, banking correspondent (BC) point, or Ujjwala/ATM-enabled CSC with Aadhaar or any government-issued identity proof and a passport-size photo; the account opens the same day. There is no deadline and no minimum balance requirement. Official portal: pmjdy.gov.in. Helpline: 1800-113-611. Additional benefits include mobile-banking deregistered free of cost and easy passbook access.`,
  },
  {
    schemeName: 'MGNREGA',
    category: 'law',
    state: null,
    sourceUrl: 'https://nrega.nic.in',
    content: `The Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA) legally guarantees every rural household in India 100 days of unskilled paid employment per financial year in public works such as water conservation, irrigation, rural roads, and plantation. Adult members volunteer; work is provided within 15 days of application, failing which an unemployment allowance equal to one-fourth of the wage rate for the first 30 days and half thereafter must be paid by the state. Wages are paid weekly or fortnightly, not later than 15 days, directly into the worker's bank or post-office account; wage rates are notified per state (for example around Rs 300/day in several states with annual indexation). A job card is mandatory: apply at the Gram Panchayat with household details and photographs; the panchayat issues a verified job card free of cost. Works are community-owned andSelected through Gram Sabha social audit ensuring transparency. How to apply: submit a written request for work at the panchayat or online via nrega.nic.in using the job-card number; track wages and muster rolls on the NREGA soft portal. Helpline: 1800-180-4011. No deadline; employment demand can be raised anytime during the year.`,
  },
  {
    schemeName: 'Pradhan Mantri Fasal Bima Yojana',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://pmfby.gov.in',
    content: `Pradhan Mantri Fasal Bima Yojana (PMFBY) is the flagship crop-insurance scheme protecting farmers against yield losses due to natural calamities, pests, and diseases. Farmers pay only 2 percent of the sum insured for kharif crops and 1.5 percent for rabi; for annual commercial and horticultural crops the share is 5 percent, with the balance subsidized by the central and state governments. The scheme insures the entire cropped area for notified crops in participating states and compensates prevented sowing, mid-season adversity, localized calamities, post-harvest losses up to 14 days, and widespread dry spells. Enrolment windows are announced per season (typically until mid-July for kharif and mid-December for rabi) with a 30-day grace period in the case of technical grounds. How to apply: register online on pmfby.gov.in through the farmer portal or CSC using Aadhaar, land record (khasra/gata number), and bank details; premiums are deducted automatically; disbursement usually completes well before the following sowing season. Helpline: 1800-208-6667 or 011-23386985. Farmers can file claims without individual field verification for village-level loss estimates notified by the government.`,
  },
  {
    schemeName: 'Atal Pension Yojana',
    category: 'scheme',
    state: null,
    sourceUrl: 'https://npscra.nsdl.co.in/scheme-details.php',
    content: `Atal Pension Yojana (APY) is a government-backed pension scheme for unorganized-sector workers guaranteeing a fixed monthly pension of Rs 1,000 to Rs 5,000 (choose at enrollment) from age 60, with the payout continuing to the spouse and, after both, the purchase value returned to the nominee. The central government co-contributes 50 percent of the member contribution up to Rs 1,000 per year for eligible subscribers who opened accounts before a notified cutoff and are not income-tax payers. Contribution amounts depend on the entry age (18-40 years) and pension slab; for example, an 18-year-old entering at the Rs 5,000 slab pays about Rs 210 per month. All savings-bank account holders not covered by any statutory social-security scheme are eligible. How to apply: visit any bank branch or use the net-banking enrollment with Aadhaar, mobile number, and nominee details; contribution auto-debits quarterly. The account stays active through retirement with easy e-Sanchay migration and Shakar portal tracking. Official detail: npscra.nsdl.co.in under Atal Pension Yojana. Helpline: 1800-110-069 (PFRDA toll-free). No yearly deadline; enrollment is open throughout the year.`,
  },
  {
    schemeName: 'National Scholarship Portal Schemes',
    category: 'policy',
    state: null,
    sourceUrl: 'https://scholarships.gov.in',
    content: `The National Scholarship Portal (NSP) aggregates centrally sponsored Merit-cum-Means, Pre-Matric, Post-Matric, and Top-Class Education scholarships administered by the Ministry of Minority Affairs, Ministry of Social Justice, Department of Higher Education, and state departments. Key components include Pre-Matric scholarship for minority students of classes 1 to 10 with 50 percent or more marks from families earning less than Rs 1 lakh per year, Post-Matric scholarship for classes 11 to PhD with income ceilings up to Rs 2.5 lakh, and the Merit-cum-Means scholarship for professional and technical courses. Benefits range from Rs 5,000 annually at the pre-matric stage to Rs 30,000 or full-course fee reimbursement for professional degrees, plus academic allowances and maintenance stipends deposited directly into Aadhaar-linked bank accounts via DBT. How to apply: register once on scholarships.gov.in with name as per Aadhaar, obtain the application number, fill the academic and bank details, upload documents, submit the form, and track status under the Check Status tab; renewal students log in with the previous-year application ID. Deadlines typically fall between August and November per scheme calendar, with institute verification in December. Helpline: 0120-6619540 or helpdesk@nsp.gov.in. Missing the institute or state nodal verification step is the most common reason for rejections.`,
  },
];

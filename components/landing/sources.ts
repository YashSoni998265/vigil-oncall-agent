// Every number on the landing page links to one of these sources (footnote = id).
export interface Source {
  id: number;
  title: string;
  publisher: string;
  url: string;
}

export const SOURCES: Source[] = [
  {
    id: 1,
    title: 'Customer-facing incidents increased by 43% during the past year; each incident costs nearly $800,000 (survey of 500 IT leaders, June 2024)',
    publisher: 'PagerDuty via Business Wire',
    url: 'https://www.businesswire.com/news/home/20240627388939/en',
  },
  {
    id: 2,
    title: 'ITIC 2024 Hourly Cost of Downtime Survey, Part 2',
    publisher: 'ITIC',
    url: 'https://calyptix.com/wp-content/uploads/ITIC-2024-Hourly-Cost-of-Downtime-Survey-Results-Part-2.pdf',
  },
  {
    id: 3,
    title: 'UPI outage attributed to surge in API calls from banks, says NPCI',
    publisher: 'Outlook Money',
    url: 'https://www.outlookmoney.com/banking/upi-outage-attributed-to-surge-in-api-calls-from-banks-says-npci',
  },
  {
    id: 4,
    title: 'UPI faces third outage in less than a fortnight (13 April 2025)',
    publisher: 'The Hitavada',
    url: 'https://www.thehitavada.com/Encyc/2025/4/13/UPI-faces-third-outage-in-less-than-a-fortnight.html',
  },
  {
    id: 5,
    title: 'Why are we so bad at mean time to repair (MTTR)? Survey of 500 engineers',
    publisher: 'Chronosphere',
    url: 'https://chronosphere.io/learn/why-are-we-so-bad-at-mean-time-to-repair-mttr/',
  },
  {
    id: 6,
    title: 'On-call: the silent force shaping engineering culture (coverage of the Catchpoint 2025 SRE Report)',
    publisher: 'DevOps.com',
    url: 'https://devops.com/on-call-the-silent-force-shaping-engineering-culture/',
  },
  {
    id: 7,
    title: 'The 2026 AI SRE market map: agents, harnesses and the data layer',
    publisher: 'Mezmo',
    url: 'https://www.mezmo.com/learn/the-2026-ai-sre-market-map-agents-harnesses-and-the-data-layer',
  },
  {
    id: 8,
    title: "PagerDuty launches industry's first end-to-end AI agent suite (8 October 2025)",
    publisher: 'PagerDuty via Business Wire',
    url: 'https://www.businesswire.com/news/home/20251008279706/en/PagerDuty-Launches-Industrys-First-End-to-End-AI-Agent-Suite-Slashing-Incident-Response-Times-and-Empowering-Teams-to-Innovate',
  },
  {
    id: 9,
    title: 'Scribe Agent: joins incident calls to transcribe and summarise',
    publisher: 'PagerDuty documentation',
    url: 'https://support.pagerduty.com/main/lang-ai/docs/scribe-agent',
  },
  {
    id: 10,
    title: 'VoiceOps: voice on-call agent (hackathon project)',
    publisher: 'Devpost',
    url: 'https://devpost.com/software/voiceops-7fga5i',
  },
  {
    id: 11,
    title: 'EZ OnCall: voice-first DevOps incident agent (ElevenLabs hackathon entry)',
    publisher: 'AI Tinkerers',
    url: 'https://nyc.aitinkerers.org/hackathons/h_1de1QREJyuU/entries/ht_5YOesV-FSpY',
  },
  {
    id: 12,
    title: 'OpsPilot Voice: AI incident commander (hackathon entry)',
    publisher: 'lablab.ai',
    url: 'https://lablab.ai/submissions/bmsx0sq33v0bpbs11m11u27d',
  },
];

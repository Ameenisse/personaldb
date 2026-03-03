const JUNK_PATTERNS = /washed\s*out|blurred|low\s*quality|cropped|not\s*clear/i;

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export interface ParsedPerson {
  id_no: string;
  name: string;
  dob: string;
  sex: string;
  contact: string;
  building: string;
  atoll: string;
  island: string;
  address_full: string;
}

/** Parse an address string using the rule: before comma = building, between comma and dot = atoll, after dot = island */
export function parseAddress(addr: string): { building: string; atoll: string; island: string } {
  const cleaned = addr.replace(/[\-–—]+\s*$/, "").trim();

  let building = "";
  let atoll = "";
  let island = "";

  const commaIdx = cleaned.indexOf(",");
  if (commaIdx !== -1) {
    building = cleaned.substring(0, commaIdx).trim();
    const afterComma = cleaned.substring(commaIdx + 1).trim();
    // Find the dot that separates atoll from island (e.g. "R. Maduvvari")
    const dotMatch = afterComma.match(/^([^.]+)\.\s*(.*)/);
    if (dotMatch) {
      atoll = dotMatch[1].trim().toUpperCase() + ".";
      island = dotMatch[2].trim();
    } else {
      island = afterComma;
    }
  } else {
    // No comma — check for dot pattern (atoll. island)
    const dotMatch = cleaned.match(/^(.+?)\s+([A-Za-z]+)\.\s*(.*)/);
    if (dotMatch) {
      building = dotMatch[1].trim();
      atoll = dotMatch[2].trim().toUpperCase() + ".";
      island = dotMatch[3].trim();
    }
  }

  return { building, atoll, island };
}

export function parsePersonText(raw: string): ParsedPerson {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !JUNK_PATTERNS.test(l));

  let id_no = "";
  let sex = "";
  let dob = "";
  let contact = "";
  let name = "";
  let building = "";
  let atoll = "";
  let island = "";
  let address_full = "";

  // Extract ID No
  for (const line of lines) {
    const idMatch = line.match(/[A-Z]\d{5,8}/);
    if (idMatch) { id_no = idMatch[0]; break; }
  }

  // Extract Sex
  for (const line of lines) {
    if (/\bMale\b/i.test(line)) { sex = "Male"; break; }
    if (/\bFemale\b/i.test(line)) { sex = "Female"; break; }
  }

  // Extract DOB
  for (const line of lines) {
    // 13 Jun 1993
    const m1 = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (m1) {
      const mm = MONTH_MAP[m1[2].toLowerCase()];
      dob = `${m1[3]}-${mm}-${m1[1].padStart(2, "0")}`;
      break;
    }
    // 1993-06-13
    const m2 = line.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) { dob = `${m2[1]}-${m2[2]}-${m2[3]}`; break; }
    // 13/06/1993 or 13-06-1993
    const m3 = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m3) { dob = `${m3[3]}-${m3[2]}-${m3[1]}`; break; }
  }

  // Extract Contact (last 7-10 digit number)
  const allNumbers = raw.match(/\b\d{7,10}\b/g);
  if (allNumbers) contact = allNumbers[allNumbers.length - 1];

  // Extract Address: "Building, Atoll. Island"
  // Rule: before comma = building, between comma and dot = atoll, after dot = island
  for (const line of lines) {
    // Look for lines containing a comma or a dot preceded by a letter
    if (/,/.test(line) || /[A-Za-z]\./.test(line)) {
      const cleaned = line.replace(/[\-–—]+\s*$/, "").trim();
      address_full = cleaned;
      const parsed = parseAddress(cleaned);
      building = parsed.building;
      atoll = parsed.atoll;
      island = parsed.island;
      break;
    }
  }

  // Extract Name: first line minus age words and id_no
  if (lines.length > 0) {
    name = lines[0]
      .replace(/[A-Z]\d{5,8}/g, "")
      .replace(/\b\d+\s*(years?|months?|yrs?|mos?)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return { id_no, name, dob, sex, contact, building, atoll, island, address_full };
}

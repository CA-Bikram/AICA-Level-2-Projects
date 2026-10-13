import { TdsChallan } from '../types/tds';

/**
 * Clean numeric string into a float or integer
 */
export function cleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // Replace Indian currency symbols, commas, spaces
  const cleaned = String(val)
    .replace(/[₹\s,`'"]/g, '')
    .replace(/Rs\.?/gi, '')
    .replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convert Indian currency words to number
 * e.g. "Rupees Fifty One Lakh Thirty Six Thousand Eight Hundred Seventy Eight Only" -> 5136878
 */
export function parseIndianWordsToNumber(text: string): number {
  if (!text) return 0;
  const match =
    text.match(/(?:Rupees|Rs\.?|INR)\s+([A-Za-z\s]+?)(?:\s+Only|\n|$)/i) ||
    text.match(/Total\s*\(\s*In\s*Words\s*\)\s*([A-Za-z\s]+?)(?:\s+Only|\n|$)/i) ||
    text.match(/Amount\s*\(\s*in\s*words\s*\)\s*[:.-]?\s*([A-Za-z\s]+?)(?:\s+Only|\n|$)/i);

  if (!match) return 0;

  const words = match[1]
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const units: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };

  let total = 0;
  let current = 0;

  for (const w of words) {
    if (units[w] !== undefined) {
      current += units[w];
    } else if (w === 'hundred') {
      current = (current || 1) * 100;
    } else if (w === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (w === 'lakh' || w === 'lakhs' || w === 'lacs' || w === 'lac') {
      total += (current || 1) * 100000;
      current = 0;
    } else if (w === 'crore' || w === 'crores') {
      total += (current || 1) * 10000000;
      current = 0;
    }
  }

  return total + current;
}

/**
 * Deterministic regex parser for Indian Income Tax Challan (ITNS 281)
 */
export function parseChallanText(text: string, fileName?: string): Partial<TdsChallan> {
  const result: Partial<TdsChallan> = {
    sourceFileName: fileName || 'Challan.txt',
    extractionMethod: 'regex',
    extractedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };

  if (!text) return result;
  const cleanStr = text.replace(/\r/g, ' ');

  // Challan No: usually 5 digits (e.g. Challan No : 32094 or Challan No 32094)
  const challanNoMatch = cleanStr.match(/(?:Challan\s*No(?:\.|umber)?)\s*[:.-]?\s*([0-9]{4,7})/i);
  if (challanNoMatch) {
    result.challanNumber = challanNoMatch[1].trim();
  }

  // BSR Code: 7 digits (e.g. BSR code : 6390009)
  const bsrMatch = cleanStr.match(/(?:BSR\s*(?:code|no)?)\s*[:.-]?\s*([0-9]{7})/i);
  if (bsrMatch) {
    result.bsrCode = bsrMatch[1].trim();
  }

  // Date of Deposit / Tender Date
  const tenderDateMatch = cleanStr.match(/(?:Tender\s*Date|Date\s*of\s*Deposit|Payment\s*Date|Deposit\s*Date)\s*[:.-]?\s*([0-9]{1,2}[-/.][0-9A-Za-z]{2,3}[-/.][0-9]{2,4})/i);
  if (tenderDateMatch) {
    result.dateOfPayment = tenderDateMatch[1].trim();
  }

  // TAN: 10 chars (e.g. MELC05986B)
  const tanMatch = cleanStr.match(/(?:TAN)\s*[:.-]?\s*([A-Z]{4}[0-9]{5}[A-Z])/i) || cleanStr.match(/\b([A-Z]{4}[0-9]{5}[A-Z])\b/);
  if (tanMatch) {
    result.tan = tanMatch[1].trim();
  }

  // Name / Deductor Name
  const nameMatch = cleanStr.match(/(?:Name)\s*[:.-]?\s*([A-Za-z0-9\s.,&()\-]+?)(?=\n|Assessment|TAN|Major|Financial|$)/i);
  if (nameMatch && nameMatch[1].trim().length > 2) {
    result.companyName = nameMatch[1].trim();
  }

  // Assessment Year
  const ayMatch = cleanStr.match(/(?:Assessment\s*Year|AY)\s*[:.-]?\s*([0-9]{4}-[0-9]{2,4})/i);
  if (ayMatch) {
    result.assessmentYear = ayMatch[1].trim();
  }

  // Financial Year
  const fyMatch = cleanStr.match(/(?:Financial\s*Year|FY)\s*[:.-]?\s*([0-9]{4}-[0-9]{2,4})/i);
  if (fyMatch) {
    result.financialYear = fyMatch[1].trim();
  }

  // Nature of Payment / Section (e.g. 94C, 94J, 94I, 192)
  const natureMatch = cleanStr.match(/(?:Nature\s*of\s*Payment|Section)\s*[:.-]?\s*([0-9]{2,3}[A-Z]?)/i);
  if (natureMatch) {
    result.natureOfPayment = natureMatch[1].trim();
  }

  // Major Head
  const majorHeadMatch = cleanStr.match(/(?:Major\s*Head)\s*[:.-]?\s*([A-Za-z0-9\s()]+?)(?=\n|Minor|$)/i);
  if (majorHeadMatch) {
    result.majorHead = majorHeadMatch[1].trim();
  }

  // Minor Head
  const minorHeadMatch = cleanStr.match(/(?:Minor\s*Head)\s*[:.-]?\s*([A-Za-z0-9\s()]+?)(?=\n|Nature|$)/i);
  if (minorHeadMatch) {
    result.minorHead = minorHeadMatch[1].trim();
  }

  // CIN (Challan Identification Number)
  const cinMatch = cleanStr.match(/(?:CIN)\s*[:.-]?\s*([A-Z0-9]{15,25})/i);
  if (cinMatch) {
    result.cin = cinMatch[1].trim();
    if (!result.bsrCode && result.cin.length >= 7) {
      const possibleBsr = result.cin.substring(0, 7);
      if (/^\d{7}$/.test(possibleBsr)) result.bsrCode = possibleBsr;
    }
  }

  // Bank Name
  const bankMatch = cleanStr.match(/(?:Bank\s*Name)\s*[:.-]?\s*([A-Za-z0-9\s&]+?)(?=\n|Bank\s*Ref|Date|$)/i);
  if (bankMatch) {
    result.bankName = bankMatch[1].trim();
  }

  // Bank Reference Number
  const bankRefMatch = cleanStr.match(/(?:Bank\s*Reference\s*Number|Bank\s*Ref(?:erence)?)\s*[:.-]?\s*([A-Za-z0-9]+)/i);
  if (bankRefMatch) {
    result.bankRefNumber = bankRefMatch[1].trim();
  }

  // --- AMOUNTS EXTRACTION ---
  // 1. Header Amount: "Amount (in Rs.) : ₹ 51,36,878"
  const headerAmountMatch = cleanStr.match(/Amount\s*(?:\(in\s*Rs\.?\))?\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  const headerAmount = headerAmountMatch ? cleanNumber(headerAmountMatch[1]) : 0;

  // 2. Breakup Table: A Tax ₹ 51,36,878
  const taxMatch =
    cleanStr.match(/(?:A\s+Tax)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i) ||
    cleanStr.match(/(?:\bTax\b)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (taxMatch) {
    result.tax = cleanNumber(taxMatch[1]);
  }

  // B Surcharge
  const surchargeMatch = cleanStr.match(/(?:B\s+Surcharge|Surcharge)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  result.surcharge = surchargeMatch ? cleanNumber(surchargeMatch[1]) : 0;

  // C Cess
  const cessMatch = cleanStr.match(/(?:C\s+Cess|Cess)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  result.cess = cessMatch ? cleanNumber(cessMatch[1]) : 0;

  // D Interest
  const interestMatch = cleanStr.match(/(?:D\s+Interest|Interest)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  result.interest = interestMatch ? cleanNumber(interestMatch[1]) : 0;

  // E Penalty
  const penaltyMatch = cleanStr.match(/(?:E\s+Penalty|Penalty)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  result.penalty = penaltyMatch ? cleanNumber(penaltyMatch[1]) : 0;

  // F Fee 234E
  const feeMatch = cleanStr.match(/(?:F\s+Fee|Fee\s+under\s+section\s+234E|234E)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
  result.fee234E = feeMatch ? cleanNumber(feeMatch[1]) : 0;

  // Total
  const totalMatch =
    cleanStr.match(/Total\s*\([A-F+]+\)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i) ||
    cleanStr.match(/Total\s*\(Amount\s*in\s*₹\)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i) ||
    cleanStr.match(/Total\s*\(in\s*₹\)\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i) ||
    cleanStr.match(/Total\s*Amount\s*[:.-]?\s*[₹Rs.\s]*([0-9,]+(?:\.[0-9]{2})?)/i);

  if (totalMatch) {
    result.total = cleanNumber(totalMatch[1]);
  }

  // 3. In words fallback
  const wordsAmount = parseIndianWordsToNumber(cleanStr);

  const bestAmount = result.total || headerAmount || result.tax || wordsAmount;
  if (!result.total && bestAmount > 0) {
    result.total = bestAmount;
  }
  if (!result.tax && bestAmount > 0) {
    result.tax = bestAmount;
  }

  // 4. Any rupee symbol in document
  if (!result.total || result.total === 0) {
    const rupeeMatches = Array.from(cleanStr.matchAll(/₹\s*([0-9,]+(?:\.[0-9]{2})?)/g));
    for (const rm of rupeeMatches) {
      const val = cleanNumber(rm[1]);
      if (val > 100) {
        result.total = val;
        result.tax = val;
        break;
      }
    }
  }

  return result;
}

/**
 * Extract text and optional page snapshot from PDF file in browser using pdfjs-dist
 */
export async function extractTextAndImageFromPdf(file: File): Promise<{ text: string; imageBase64?: string }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    let renderedImageBase64: string | undefined = undefined;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `\n--- Page ${pageNum} ---\n` + pageText;

      // Render the 1st page to canvas to pass as image to Gemini if needed
      if (pageNum === 1 && typeof document !== 'undefined') {
        try {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await (page as any).render({ canvasContext: context, viewport, canvas }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            const commaIdx = dataUrl.indexOf(',');
            renderedImageBase64 = commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl;
          }
        } catch (canvasErr) {
          console.warn('Could not render PDF page to canvas image:', canvasErr);
        }
      }
    }

    return { text: fullText.trim(), imageBase64: renderedImageBase64 };
  } catch (err) {
    console.warn('pdfjs extraction failed or library issue, falling back:', err);
    return { text: '' };
  }
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      const commaIndex = base64String.indexOf(',');
      resolve(commaIndex !== -1 ? base64String.substring(commaIndex + 1) : base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Main parser coordinator: sends raw file base64 to server (which parses PDF natively and calls Gemini)
 * with robust local parsing fallback.
 */
export async function extractChallanFromFile(file: File): Promise<TdsChallan> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

  let rawText = '';
  let imageBase64: string | undefined = undefined;
  let mimeType = isPdf ? 'application/pdf' : file.type || 'image/png';

  // 1. Convert file to base64 directly so the server can inspect the complete PDF/Image
  try {
    imageBase64 = await fileToBase64(file);
  } catch (err) {
    console.warn('Failed to convert file to base64:', err);
  }

  // 2. Also try client-side PDF text extraction in parallel
  if (isPdf) {
    try {
      const pdfRes = await extractTextAndImageFromPdf(file);
      rawText = pdfRes.text;
      if (pdfRes.imageBase64 && !imageBase64) {
        imageBase64 = pdfRes.imageBase64;
        mimeType = 'image/png';
      }
    } catch (e) {
      console.log('Client-side PDF text extraction skipped:', e);
    }
  }

  // 3. Send to Server Endpoint (server extracts text from PDF buffer and runs Gemini with model fallback cascade)
  try {
    const response = await fetch('/api/extract-challan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        rawText: rawText || undefined,
        fileName: file.name,
      }),
    });

    if (response.ok) {
      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const d = resJson.data;
        const tax = cleanNumber(d.tax);
        const surcharge = cleanNumber(d.surcharge);
        const cess = cleanNumber(d.cess);
        const interest = cleanNumber(d.interest);
        const penalty = cleanNumber(d.penalty);
        const fee234E = cleanNumber(d.fee234E);
        let total = cleanNumber(d.total);

        // If total is 0 or missing, compute from components
        if (!total && tax > 0) {
          total = tax + surcharge + cess + interest + penalty + fee234E;
        }

        let finalTax = tax;
        if (finalTax === 0 && total > 0 && surcharge === 0 && cess === 0 && interest === 0 && penalty === 0) {
          finalTax = total;
        }

        // Check if client text had an amount that server might have missed
        if (finalTax === 0 && total === 0 && rawText) {
          const clientParsed = parseChallanText(rawText, file.name);
          if ((clientParsed.total || 0) > 0) {
            total = clientParsed.total || 0;
            finalTax = clientParsed.tax || total;
          }
        }

        return {
          id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          challanNumber: String(d.challanNumber || '').trim(),
          bsrCode: String(d.bsrCode || '').trim(),
          dateOfPayment: String(d.dateOfPayment || '').trim(),
          tax: finalTax,
          surcharge,
          cess,
          interest,
          penalty,
          fee234E,
          total: total || finalTax,
          tan: d.tan,
          companyName: d.companyName,
          assessmentYear: d.assessmentYear,
          financialYear: d.financialYear,
          majorHead: d.majorHead,
          minorHead: d.minorHead,
          natureOfPayment: d.natureOfPayment,
          cin: d.cin,
          bankName: d.bankName,
          bankRefNumber: d.bankRefNumber,
          sourceFileName: file.name,
          extractedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          extractionMethod: (resJson.method as any) || 'ai',
        };
      }
    }
  } catch (err) {
    console.warn('Server extraction call failed, using client fallback:', err);
  }

  // 4. Deterministic Regex fallback from extracted client text
  if (rawText) {
    const parsed = parseChallanText(rawText, file.name);
    return {
      id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      challanNumber: parsed.challanNumber || '00000',
      bsrCode: parsed.bsrCode || '0000000',
      dateOfPayment: parsed.dateOfPayment || new Date().toLocaleDateString('en-GB'),
      tax: parsed.tax || 0,
      surcharge: parsed.surcharge || 0,
      cess: parsed.cess || 0,
      interest: parsed.interest || 0,
      penalty: parsed.penalty || 0,
      fee234E: parsed.fee234E || 0,
      total: parsed.total || (parsed.tax || 0),
      tan: parsed.tan,
      companyName: parsed.companyName,
      assessmentYear: parsed.assessmentYear,
      financialYear: parsed.financialYear,
      majorHead: parsed.majorHead,
      minorHead: parsed.minorHead,
      natureOfPayment: parsed.natureOfPayment,
      cin: parsed.cin,
      bankName: parsed.bankName,
      bankRefNumber: parsed.bankRefNumber,
      sourceFileName: file.name,
      extractedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      extractionMethod: 'regex',
    };
  }

  // 5. Final fallback record
  return {
    id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    challanNumber: '00000',
    bsrCode: '0000000',
    dateOfPayment: new Date().toLocaleDateString('en-GB'),
    tax: 0,
    surcharge: 0,
    cess: 0,
    interest: 0,
    penalty: 0,
    fee234E: 0,
    total: 0,
    sourceFileName: file.name,
    extractedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    extractionMethod: 'manual',
  };
}

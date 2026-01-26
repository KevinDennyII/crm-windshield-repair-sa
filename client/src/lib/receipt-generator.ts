import { jsPDF } from 'jspdf';
import type { Job, Vehicle, Part, JobType, CustomerType } from '@shared/schema';
import logoImage from '@assets/WhatsApp_Image_2026-01-25_at_7.43.18_PM_1769394237285.jpeg';

export type ReceiptType = 'dealer' | 'fleet' | 'rock_chip_repair' | 'windshield_replacement' | 'other_glass_replacement';

const COMPANY_INFO = {
  name: "Windshield Repair SA",
  address: "901 SE Military Hwy #C051",
  cityStateZip: "San Antonio, TX 78214",
  email: "windshieldrepairsa@gmail.com",
  phone: "2108900210",
};

export function determineReceiptType(job: Job): ReceiptType {
  if (job.customerType === 'dealer') {
    return 'dealer';
  }
  
  if (job.customerType === 'fleet') {
    return 'fleet';
  }
  
  const allParts: Part[] = job.vehicles.flatMap(v => v.parts);
  
  const hasWindshieldRepair = allParts.some(p => p.jobType === 'windshield_repair');
  if (hasWindshieldRepair && allParts.length === 1) {
    return 'rock_chip_repair';
  }
  
  const hasWindshieldReplacement = allParts.some(p => p.jobType === 'windshield_replacement');
  if (hasWindshieldReplacement) {
    return 'windshield_replacement';
  }
  
  return 'other_glass_replacement';
}

export function getReceiptTypeLabel(type: ReceiptType): string {
  switch (type) {
    case 'dealer': return 'Dealer Invoice';
    case 'fleet': return 'Fleet Invoice';
    case 'rock_chip_repair': return 'Rock Chip Repair Invoice';
    case 'windshield_replacement': return 'Windshield Replacement Invoice';
    case 'other_glass_replacement': return 'Glass Replacement Invoice';
  }
}

function formatJobTypeLabel(jobType: JobType): string {
  switch (jobType) {
    case 'windshield_replacement': return 'Windshield Replacement';
    case 'windshield_repair': return 'Rock Chip Repair';
    case 'door_glass': return 'Door Glass Replacement';
    case 'back_glass': return 'Back Glass Replacement';
    case 'quarter_glass': return 'Quarter Glass Replacement';
    case 'sunroof': return 'Sunroof Replacement';
    case 'side_mirror': return 'Side Mirror Replacement';
    default: return 'Glass Service';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

async function addCompanyHeader(doc: jsPDF, yPos: number): Promise<number> {
  try {
    const logoData = await loadImageAsBase64(logoImage);
    doc.addImage(logoData, 'JPEG', 20, yPos - 5, 60, 20);
    yPos += 18;
  } catch (e) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(COMPANY_INFO.name, 20, yPos);
    yPos += 6;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, yPos);
  doc.text(COMPANY_INFO.cityStateZip, 20, yPos + 5);
  doc.text(COMPANY_INFO.email, 20, yPos + 10);
  doc.text(COMPANY_INFO.phone, 20, yPos + 15);
  
  return yPos + 24;
}

function addInvoiceHeader(doc: jsPDF, job: Job, yPos: number): number {
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 150, yPos, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = `0126-${job.jobNumber.slice(-4)}`;
  doc.text(`Invoice#: ${invoiceNumber}`, 190, yPos + 10, { align: 'right' });
  doc.text(`Date: ${formatDate(job.installDate || job.createdAt)}`, 190, yPos + 15, { align: 'right' });
  
  return yPos + 25;
}

function addCustomerInfo(doc: jsPDF, job: Job, yPos: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('To:', 20, yPos);
  
  doc.setFont('helvetica', 'normal');
  const customerName = job.isBusiness && job.businessName ? job.businessName : `${job.firstName} ${job.lastName}`;
  doc.text(customerName, 20, yPos + 6);
  
  let lineOffset = 11;
  if (job.streetAddress) {
    doc.text(job.streetAddress, 20, yPos + lineOffset);
    lineOffset += 5;
  }
  if (job.city && job.state && job.zipCode) {
    doc.text(`${job.city}, ${job.state} ${job.zipCode}`, 20, yPos + lineOffset);
    lineOffset += 5;
  }
  if (job.phone) {
    doc.text(job.phone, 20, yPos + lineOffset);
    lineOffset += 5;
  }
  
  return yPos + lineOffset + 5;
}

function addLineItems(doc: jsPDF, job: Job, yPos: number): { yPos: number; subtotal: number } {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 20, yPos);
  doc.text('DESCRIPTION', 35, yPos);
  doc.text('QTY', 120, yPos);
  doc.text('PRICE', 140, yPos);
  doc.text('TOTAL', 170, yPos);
  
  doc.setDrawColor(200);
  doc.line(20, yPos + 2, 190, yPos + 2);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  
  let itemNum = 1;
  let subtotal = 0;
  
  for (const vehicle of job.vehicles) {
    for (const part of vehicle.parts) {
      const vehicleDesc = `${vehicle.vehicleYear} ${vehicle.vehicleMake} ${vehicle.vehicleModel}`;
      const partDesc = formatJobTypeLabel(part.jobType);
      const vinDesc = vehicle.vin ? `VIN ${vehicle.vin}` : '';
      
      doc.text(String(itemNum), 20, yPos);
      doc.text(vehicleDesc, 35, yPos);
      yPos += 5;
      doc.text(partDesc, 35, yPos);
      yPos += 5;
      if (vinDesc) {
        doc.setFontSize(8);
        doc.text(vinDesc, 35, yPos);
        doc.setFontSize(9);
        yPos += 5;
      }
      
      doc.text('1', 123, yPos - 10);
      doc.text(formatCurrency(part.partTotal), 140, yPos - 10);
      doc.text(formatCurrency(part.partTotal), 175, yPos - 10, { align: 'right' });
      
      subtotal += part.partTotal;
      itemNum++;
      yPos += 3;
    }
  }
  
  return { yPos, subtotal };
}

function addTotals(doc: jsPDF, job: Job, yPos: number, subtotal: number): number {
  doc.setDrawColor(200);
  doc.line(130, yPos, 190, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SUBTOTAL', 140, yPos);
  doc.text(formatCurrency(subtotal), 190, yPos, { align: 'right' });
  yPos += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 140, yPos);
  doc.text(formatCurrency(job.totalDue), 190, yPos, { align: 'right' });
  yPos += 8;
  
  if (job.amountPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('PAID', 140, yPos);
    doc.text(formatCurrency(job.amountPaid), 190, yPos, { align: 'right' });
    yPos += 8;
  }
  
  if (job.balanceDue > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE DUE', 140, yPos);
    doc.text(formatCurrency(job.balanceDue), 190, yPos, { align: 'right' });
    yPos += 8;
  }
  
  return yPos + 5;
}

function addPaymentInfo(doc: jsPDF, job: Job, yPos: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT INFO', 20, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`DUE DATE: ${formatDate(job.installDate || job.createdAt)}`, 20, yPos);
  yPos += 5;
  
  doc.setFontSize(8);
  const cardNotice = 'CARD PAYMENT NOTICE: Card payments will appear on your bank statement as "Christian Trevino". Disputed charges that are confirmed as valid may be subject to a $25 processing fee, in addition to the original service total.';
  const splitNotice = doc.splitTextToSize(cardNotice, 80);
  doc.text(splitNotice, 20, yPos);
  
  return yPos + splitNotice.length * 4 + 5;
}

function addSignatureLine(doc: jsPDF, yPos: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER ACKNOWLEDGMENT', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('By signing below, I acknowledge that I have read and agree to the warranty terms stated above.', 20, yPos);
  yPos += 12;
  
  doc.setDrawColor(100);
  doc.line(20, yPos, 100, yPos);
  doc.text('Customer Signature', 20, yPos + 5);
  
  doc.line(120, yPos, 180, yPos);
  doc.text('Date', 120, yPos + 5);
  
  return yPos + 15;
}

function addCalibrationDeclinedDisclaimer(doc: jsPDF, yPos: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 0, 0);
  doc.text('CALIBRATION DECLINED ACKNOWLEDGMENT', 20, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  
  const disclaimer = `The customer has declined ADAS (Advanced Driver Assistance System) calibration service following windshield replacement. Customer acknowledges and understands that:

1. Modern vehicles equipped with ADAS features (lane departure warning, forward collision warning, automatic emergency braking, etc.) require calibration after windshield replacement.

2. Failure to calibrate these systems may result in improper function of safety features, potentially causing accidents, injuries, or property damage.

3. Windshield Repair SA is not liable for any accidents, injuries, damages, or malfunctions of ADAS systems resulting from the customer's decision to decline calibration service.

4. By declining calibration, the customer assumes full responsibility for any consequences related to uncalibrated ADAS systems.`;

  const splitDisclaimer = doc.splitTextToSize(disclaimer, 170);
  doc.text(splitDisclaimer, 20, yPos);
  yPos += splitDisclaimer.length * 3 + 10;
  
  return yPos;
}

function addDealerWarranty(doc: jsPDF, yPos: number): number {
  return yPos;
}

function addFleetWarranty(doc: jsPDF, yPos: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('WARRANTY - REPLACEMENTS', 20, yPos);
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const warranty = `Windshield Repair SA warrants that the installation or repair will be performed to the highest standards and will be free from defects in workmanship. All of our workmanship is guaranteed for the life of the vehicle, which includes wind noise and water leaks.

Exclusions include, but are not limited to:
- Damage resulting from auto collision, new rock chips or cracks
- Leaks caused by rust deterioration
- Aftermarket antennas or devices
- Damages caused by a dysfunctional door regulator
- Any issues arising from previous installations (or other work done to the vehicle) not performed by Windshield Repair SA.

Our liability under this warranty is limited to the repair or replacement of the auto glass. In the event of a water leak, it is the customer's responsibility to ensure the vehicle is kept away from rain & moisture. Windshield Repair SA is not liable for any incidental or consequential damages arising from the use or inability to use the auto glass.

This warranty is non-transferable and expires with the change of ownership of this vehicle.

If you experience any warranty issues, please contact us immediately at 210-890-0210 so we may evaluate the issue and take necessary action. These actions may include resealing, reinstalling, or repairing. Mobile fee may apply.`;

  const splitWarranty = doc.splitTextToSize(warranty, 170);
  doc.text(splitWarranty, 20, yPos);
  yPos += splitWarranty.length * 3 + 5;
  
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT - VEHICLES WITH LKAS & FORWARD COLLISION:', 20, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  
  const adasNotice = `ADAS Driver Safety System Calibration
The customer acknowledges that certain windshields replaced by Windshield Repair SA may contain sensors for items such as lane departure mitigation, LKAS (lane keep assist), forward collision alert, or any other sensor which controls the vehicle's movement. Windshield Repair SA has provided notice that the vehicle manufacturer may require the windshield sensor to be recalibrated after the new windshield is installed. We always recommend recalibration be performed to ensure these critical sensors work effectively, for your safety. The customer acknowledges that if recalibration is NOT performed, these systems may malfunction at any time after installation, whether or not an indicator light or error code appears on the vehicle dashboard.`;

  const splitAdas = doc.splitTextToSize(adasNotice, 170);
  doc.text(splitAdas, 20, yPos);
  
  return yPos + splitAdas.length * 3 + 5;
}

function addRockChipWarranty(doc: jsPDF, yPos: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('WARRANTY', 20, yPos);
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const warranty = `Upon completion of the repair, we provide a lifetime warranty to ensure the chip or crack will not spread from its original repair location. In the event that the chip does spread, we will either:

- Perform a repair on the growth portion at no cost (IF the damage is deemed repairable by one of our technicians) a maximum of two times, OR

- Credit 40% of the amount paid for the original repair to be applied toward a full windshield replacement by our company (IF the damage is deemed NOT repairable by one of our technicians, including but not limited to: if it has grown more than 4 inches)

Please note that rock chip repair is primarily focused on restoring the structural integrity of the windshield, not for cosmetic improvement. You may still notice the chip or crack after the repair is completed - this is normal.

Due to the nature of the glass being pre-damaged, there is a possibility that the chip could spread during the repair process. This becomes even more likely with extreme weather (extreme heat and cold). If this is the case, we will not charge you for the attempted repair, however, we cannot guarantee the windshield against further damage.

If you experience any warranty issues, please contact us immediately at 210-890-0210 so we may evaluate the issue and take necessary action. These actions may include repairing spread or quoting for replacement if the spread is too large. Mobile fee may apply if a warranty appointment is scheduled but the chip or crack hasn't actually spread since the first repair.`;

  const splitWarranty = doc.splitTextToSize(warranty, 170);
  doc.text(splitWarranty, 20, yPos);
  
  return yPos + splitWarranty.length * 3 + 5;
}

function addWindshieldReplacementWarranty(doc: jsPDF, yPos: number): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ADDITIONAL INFO', 20, yPos);
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const bonusInfo = `Your purchase comes with 1 free rock chip repair, performed by Windshield Repair SA, if it should occur within the first year of your windshield replacement.
The chip must be the size of a quarter or smaller to qualify, and a mobile fee will apply if the service is performed outside of 1604. Not redeemable for cash value.
Thank you for your business!`;

  const splitBonus = doc.splitTextToSize(bonusInfo, 170);
  doc.text(splitBonus, 20, yPos);
  yPos += splitBonus.length * 3 + 5;
  
  return addFleetWarranty(doc, yPos);
}

function addOtherGlassWarranty(doc: jsPDF, yPos: number): number {
  return addFleetWarranty(doc, yPos);
}

export interface ReceiptResult {
  blobUrl: string;
  filename: string;
}

export async function generateReceiptPreview(job: Job): Promise<ReceiptResult> {
  const receiptType = determineReceiptType(job);
  const doc = new jsPDF();
  const isRetailCustomer = !job.isBusiness;
  
  let yPos = 20;
  
  yPos = await addCompanyHeader(doc, yPos);
  yPos = addInvoiceHeader(doc, job, yPos - 10);
  yPos = addCustomerInfo(doc, job, yPos + 5);
  
  const { yPos: lineYPos, subtotal } = addLineItems(doc, job, yPos + 5);
  yPos = lineYPos;
  
  yPos = addTotals(doc, job, yPos, subtotal);
  yPos = addPaymentInfo(doc, job, yPos + 5);
  
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos += 10;
  
  // Add calibration declined disclaimer if applicable
  if (job.calibrationDeclined && receiptType === 'windshield_replacement') {
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }
    yPos = addCalibrationDeclinedDisclaimer(doc, yPos);
  }
  
  switch (receiptType) {
    case 'dealer':
      yPos = addDealerWarranty(doc, yPos);
      break;
    case 'fleet':
      yPos = addFleetWarranty(doc, yPos);
      break;
    case 'rock_chip_repair':
      yPos = addRockChipWarranty(doc, yPos);
      break;
    case 'windshield_replacement':
      yPos = addWindshieldReplacementWarranty(doc, yPos);
      break;
    case 'other_glass_replacement':
      yPos = addOtherGlassWarranty(doc, yPos);
      break;
  }
  
  if (isRetailCustomer && receiptType !== 'dealer') {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    yPos = addSignatureLine(doc, yPos + 10);
  }
  
  const customerName = job.isBusiness && job.businessName 
    ? job.businessName.replace(/\s+/g, '_')
    : `${job.lastName}_${job.firstName}`;
  const dateStr = formatDate(job.installDate || job.createdAt).replace(/\s+/g, '_').replace(/,/g, '');
  const invoiceNum = `0126-${job.jobNumber.slice(-4)}`;
  const filename = `${customerName}_${dateStr}_${invoiceNum}.pdf`;
  
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  
  return { blobUrl, filename };
}

export function downloadReceipt(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateReceipt(job: Job): void {
  generateReceiptPreview(job).then(({ blobUrl, filename }) => {
    downloadReceipt(blobUrl, filename);
    URL.revokeObjectURL(blobUrl);
  });
}

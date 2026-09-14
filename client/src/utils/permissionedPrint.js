import { api } from "../api/client";
import * as documents from "./print";
export async function authorizeAction(module, action) {
  try { await api("/auth/authorize", {method:"POST", body:JSON.stringify({module,action})}); return true; }
  catch (error) { window.alert(error.message); return false; }
}
export async function authorizedAction(module, action, run) {
  if (await authorizeAction(module,action)) return run();
}
async function print(module, renderer, record) {
  // Reserve during the click gesture so a later API response is not a blocked popup.
  const win = window.open("", "_blank");
  if (!win) { window.alert("Allow pop-ups to print this document."); return; }
  if (!await authorizeAction(module,"print")) { win.close(); return; }
  documents.reservePrintWindow(win);
  renderer(record);
}
export const printMedicalCertificate = record => print("charges",documents.printMedicalCertificate,record);
export const printCase = record => print("consultations",documents.printCase,record);
export const printPatientRecord = record => print("patients",documents.printPatientRecord,record);
export const printPrescription = record => print("prescriptions",documents.printPrescription,record);
export const printLaboratoryRequest = record => print("laboratory",documents.printLaboratoryRequest,record);
export const printStatementOfAccount = (record, module = "billing") => print(module,documents.printStatementOfAccount,record);

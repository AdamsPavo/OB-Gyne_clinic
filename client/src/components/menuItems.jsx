import { Boxes, CalendarDays, ClipboardPlus, CreditCard, FileBarChart, FlaskConical, HeartPulse, LayoutDashboard, Pill, ReceiptText, Users, Wrench } from "lucide-react";

export const menuItems = [
  { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={19} /> },
  { name: "Patients", path: "/patients", icon: <Users size={19} /> },
  { name: "Appointments", path: "/appointments", icon: <CalendarDays size={19} /> },
  { name: "Consultations", path: "/consultations", icon: <ClipboardPlus size={19} /> },
  { name: "Prenatal Records", path: "/prenatal-records", icon: <HeartPulse size={19} /> },
  { name: "Prescriptions", path: "/prescriptions", icon: <Pill size={19} /> },
  { name: "Laboratory", path: "/laboratory-requests", icon: <FlaskConical size={19} /> },
  { name: "Billing", path: "/billing", icon: <CreditCard size={19} /> },
  { name: "Reports", path: "/reports", icon: <FileBarChart size={19} /> },
  { name: "Tools", path: "/tools", icon: <Wrench size={19} /> },
  { name: "Inventory", path: "/inventory", icon: <Boxes size={19} /> },
  { name: "Patient Charges", path: "/patient-charges", icon: <ReceiptText size={19} /> },
];

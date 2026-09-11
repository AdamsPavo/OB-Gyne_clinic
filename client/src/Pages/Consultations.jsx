import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../api/client";
import { latestConsultation, prefillConsultation } from "../utils/consultationPrefill";

const now = () => new Date().toISOString().slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);
const CONSULTATION_DRAFT_KEY = "obgyn_consultation_draft";

const readConsultationDraft = (key = CONSULTATION_DRAFT_KEY) => {
  try {
    return JSON.parse(
      localStorage.getItem(key) || "null",
    );
  } catch {
    return null;
  }
};

const toDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateEstimatedDeliveryDate = (lmpDate) => {
  if (!lmpDate) return "";
  const lmp = new Date(`${lmpDate}T00:00:00`);
  if (Number.isNaN(lmp.getTime())) return "";
  lmp.setDate(lmp.getDate() + 280);
  return toDateInput(lmp);
};

const calculateGestationalAge = (lmpDate, visitDate) => {
  if (!lmpDate || !visitDate) return { weeks: "", days: "" };
  const lmp = new Date(`${lmpDate}T00:00:00`);
  const visit = new Date(visitDate);
  if (Number.isNaN(lmp.getTime()) || Number.isNaN(visit.getTime())) {
    return { weeks: "", days: "" };
  }
  const totalDays = Math.floor((visit - lmp) / 86400000);
  if (totalDays < 0) return { weeks: "", days: "" };
  return {
    weeks: String(Math.floor(totalDays / 7)),
    days: String(totalDays % 7),
  };
};

const calculateAge = (birthDate, referenceDate = new Date()) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDifference = referenceDate.getMonth() - birth.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && referenceDate.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age;
};

const parseBloodPressure = (value) => {
  const match = String(value || "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  return match
    ? { systolic: Number(match[1]), diastolic: Number(match[2]) }
    : { systolic: null, diastolic: null };
};

const createInitialForm = (patientId = "") => ({
  patient_id: patientId,
  appointment_id: "",
  service_type: "",
  service_id: "",
  consultation_date: now(),
  chief_complaint: "",
  history_present_illness: "",
  blood_pressure: "",
  temperature_c: "",
  weight_kg: "",
  height_cm: "",
  diagnoses: "",
  treatment: "",
  doctor_notes: "",
  follow_up_date: "",

  // Prenatal fields
  lmp_date: "",
  expected_delivery_date: "",
  gestational_weeks: "",
  gestational_days: "",
  gravida: "",
  para: "",
  abortion_count: "",
  living_children: "",
  fundal_height_cm: "",
  fetal_heart_rate: "",
  fetal_movement: "",
  fetal_presentation: "",
  number_of_fetuses: "1",
  edema: "",
  risk_level: "Low Risk",
  risk_reasons: [],
  vaginal_bleeding: false,
  severe_headache: false,
  blurred_vision: false,
  severe_abdominal_pain: false,
  chronic_hypertension: false,
  diabetes: false,
  previous_preeclampsia: false,
  kidney_disease: false,
  autoimmune_disease: false,
  prenatal_notes: "",
  next_prenatal_visit: "",
});

const blankMedicine = {
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const laboratoryProcedures = [
  {
    category: "Hematology",
    tests: [
      "Complete Blood Count (CBC)",
      "Hemoglobin and Hematocrit",
      "Platelet Count",
      "Blood Typing",
      "Clotting Time",
      "Bleeding Time",
    ],
  },
  {
    category: "Urinalysis and Stool Examination",
    tests: [
      "Urinalysis",
      "Urine Pregnancy Test",
      "Fecalysis",
      "Occult Blood Test",
    ],
  },
  {
    category: "Blood Chemistry",
    tests: [
      "Fasting Blood Sugar (FBS)",
      "Random Blood Sugar (RBS)",
      "HbA1c",
      "Blood Urea Nitrogen (BUN)",
      "Creatinine",
      "Uric Acid",
      "Lipid Profile",
      "SGPT / ALT",
      "SGOT / AST",
    ],
  },
  {
    category: "Serology and Immunology",
    tests: [
      "HBsAg",
      "HIV Screening",
      "VDRL / RPR",
      "Dengue Test",
      "Thyroid Function Test",
      "Rubella IgG",
      "Toxoplasma Test",
    ],
  },
  {
    category: "OB-GYN Procedures",
    tests: [
      "Pap Smear",
      "Vaginal Smear",
      "Cervical Culture",
      "High Vaginal Swab",
      "Beta hCG",
      "Pelvic Ultrasound",
      "Transvaginal Ultrasound",
      "Obstetric Ultrasound",
    ],
  },
];

export default function Consultations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientIdFromUrl =
    searchParams.get("patient") || "";

  const appointmentIdFromUrl =
    searchParams.get("appointment") || "";
  const editCaseId = searchParams.get("edit") || "";
  const prenatalFromUrl = searchParams.get("prenatal") === "1";
  const pregnancyIdFromUrl = searchParams.get("pregnancy") || "";
  const [pregnancyContext, setPregnancyContext] = useState({ patientId: "", pregnancy: null, error: "", loading: false });
  const pendingCase = useRef(null);
  const draftKey = prenatalFromUrl ? `${CONSULTATION_DRAFT_KEY}_prenatal_${patientIdFromUrl || "new"}` : CONSULTATION_DRAFT_KEY;
  const [editingCase, setEditingCase] = useState(null);
  const [editLoadFailed, setEditLoadFailed] = useState(false);
  const candidateDraft = editCaseId ? null : readConsultationDraft(draftKey);
  const savedDraft = patientIdFromUrl && String(candidateDraft?.form?.patient_id) !== patientIdFromUrl ? null : candidateDraft;
  const touchedHistoryFields = useRef(new Set());
  const [previousConsultation, setPreviousConsultation] = useState(null);
  const [historyStatus, setHistoryStatus] = useState({ patientId: "", loading: false, error: "" });

  const [patients, setPatients] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [patientSearch, setPatientSearch] =
    useState("");

  const [
    showPatientResults,
    setShowPatientResults,
  ] = useState(false);

  const [appointment, setAppointment] =
    useState(null);

  const [form, setForm] = useState(() => ({
    ...createInitialForm(patientIdFromUrl),
    ...(savedDraft?.form || {}),
    patient_id:
      patientIdFromUrl ||
      savedDraft?.form?.patient_id ||
      "",
  }));

  const isPrenatal =
    /prenatal/i.test(form.service_type);

  const [prescription, setPrescription] =
    useState(savedDraft?.prescription || {
      issued_date: today(),
      diagnosis: "",
      notes: "",
      items: [{ ...blankMedicine }],
    });

  const [laboratory, setLaboratory] = useState(savedDraft?.laboratory || {
    requested_date: today(),
    indication: "",
    notes: "",
    items: [],
    other_test: "",
  });

  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentUser = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}",
      );
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    if (editCaseId) return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        form,
        prescription,
        laboratory,
      }),
    );
  }, [form, prescription, laboratory, editCaseId, draftKey]);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setResult("");

      try {
        const requests = [
          api("/patients"),
          api("/services/active"),
        ];

        if (editCaseId) {
          requests.push(api(`/cases/${editCaseId}`));
        } else if (appointmentIdFromUrl) {
          requests.push(
            api(
              `/appointments/${appointmentIdFromUrl}`,
            ),
          );
        }

        const responses = await Promise.all(requests);
        const patientRecords = responses[0];
        const serviceRecords = responses[1];
        const appointmentRecord = responses[2];

        setPatients(
          Array.isArray(patientRecords)
            ? patientRecords
            : [],
        );
        setServiceTypes(
          Array.isArray(serviceRecords)
            ? serviceRecords
            : [],
        );

        if (editCaseId) {
          const saved = responses[2];
          const prenatal = saved.prenatal_record || {};
          const initial = createInitialForm(String(saved.patient_id));
          for (const key of Object.keys(initial)) {
            if (saved[key] != null && !Array.isArray(saved[key])) initial[key] = String(saved[key]);
            if (prenatal[key] != null) initial[key] = String(prenatal[key]);
          }
          initial.patient_id = String(saved.patient_id);
          initial.appointment_id = saved.appointment_id ? String(saved.appointment_id) : "";
          initial.consultation_date = saved.consultation_date?.replace(" ", "T").slice(0, 16) || "";
          initial.diagnoses = (saved.diagnoses || []).map((item) => item.diagnosis_name).join("\n");
          initial.expected_delivery_date = prenatal.estimated_delivery_date || "";
          initial.prenatal_notes = prenatal.notes || "";
          initial.next_prenatal_visit = prenatal.next_visit_date || "";
          setForm(initial);
          setEditingCase(saved);
          setEditLoadFailed(false);
          setPrescription({ issued_date: today(), diagnosis: "", notes: "", items: [{ ...blankMedicine }] });
          setLaboratory({ requested_date: today(), indication: "", notes: "", items: [], other_test: "" });
        } else if (appointmentRecord) {
          setAppointment(appointmentRecord);

          setForm((currentForm) => ({
            ...currentForm,

            patient_id: String(
              appointmentRecord.patient_id ||
                patientIdFromUrl ||
                "",
            ),

            appointment_id: String(
              appointmentRecord.id ||
                appointmentIdFromUrl ||
                "",
            ),

            service_type:
              appointmentRecord.service_name || appointmentRecord.service ||
              appointmentRecord.service_type ||
              appointmentRecord.type_of_service ||
              "",
            service_id: String(appointmentRecord.service_id || ""),

            consultation_date:
              appointmentRecord.appointment_date
                ? appointmentRecord.appointment_date.slice(
                    0,
                    16,
                  )
                : currentForm.consultation_date,
          }));
        } else if (prenatalFromUrl) {
          const prenatalService = serviceRecords.find((service) => /prenatal/i.test(service.service_name));
          setForm((currentForm) => ({
            ...currentForm,
            patient_id: patientIdFromUrl || currentForm.patient_id,
            service_id: prenatalService ? String(prenatalService.id) : "",
            service_type: prenatalService?.service_name || "Prenatal Checkup",
          }));
          if (!prenatalService) setResult("Add or activate a prenatal service in Tools before saving this consultation.");
        } else if (patientIdFromUrl) {
          setForm((currentForm) => ({
            ...currentForm,
            patient_id: String(
              patientIdFromUrl,
            ),
          }));
        }
      } catch (error) {
        if (editCaseId) setEditLoadFailed(true);
        setResult(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [
    patientIdFromUrl,
    appointmentIdFromUrl,
    editCaseId,
    prenatalFromUrl,
  ]);

  const selectedPatient = patients.find(
    (patient) =>
      String(patient.id) ===
      String(form.patient_id),
  );

  useEffect(() => {
    if (editCaseId || loading || !form.patient_id) return;
    let cancelled = false;
    const patientId = String(form.patient_id);
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setPreviousConsultation(null);
      setHistoryStatus({ patientId, loading: true, error: "" });
      try {
        const cases = await api(`/patients/${patientId}/cases`);
        const latest = latestConsultation(cases);
        const previous = latest ? await api(`/cases/${latest.id}`) : null;
        if (cancelled) return;
        if (previous && String(previous.patient_id) === patientId) {
          setPreviousConsultation(previous);
          setForm((current) => String(current.patient_id) === patientId
            ? prefillConsultation(current, { ...previous, prenatal_record: null }, touchedHistoryFields.current) : current);
        }
        setHistoryStatus({ patientId, loading: false, error: "" });
      } catch {
        if (!cancelled) setHistoryStatus({ patientId, loading: false, error: "Previous consultation could not be loaded. You can enter the history manually." });
      }
    });
    return () => { cancelled = true; };
  }, [form.patient_id, editCaseId, loading]);

  const historyLoading = !editCaseId && Boolean(form.patient_id) &&
    (historyStatus.patientId !== String(form.patient_id) || historyStatus.loading);

  useEffect(() => {
    if (!isPrenatal || !form.patient_id || loading) return;
    let cancelled = false;
    const patientId = String(form.patient_id);
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setPregnancyContext({ patientId, pregnancy: null, error: "", loading: true });
      try {
        const pregnancyId = editingCase?.prenatal_record?.pregnancy_id || pregnancyIdFromUrl;
        const response = pregnancyId ? { pregnancy: await api(`/pregnancies/${pregnancyId}`) } : await api(`/pregnancies/current/${patientId}`);
        if (cancelled) return;
        const pregnancy = response.pregnancy;
        if (pregnancy && String(pregnancy.patient_id) !== patientId) throw new Error("This pregnancy belongs to another patient.");
        if (!editCaseId && pregnancy && pregnancy.status !== "Active") throw new Error("This pregnancy is closed or awaiting review. Open Prenatal Records to select or start an active pregnancy.");
        if (!editCaseId && response.needs_review) throw new Error("Review the patient's historical pregnancy records and activate the current pregnancy, or start a new one.");
        setPregnancyContext({ patientId, pregnancy, error: "", loading: false });
        if (!editCaseId) setForm((current) => {
          if (String(current.patient_id) !== patientId) return current;
          if (!pregnancy) return { ...current, lmp_date: touchedHistoryFields.current.has("lmp_date") ? current.lmp_date : "", expected_delivery_date: touchedHistoryFields.current.has("lmp_date") ? current.expected_delivery_date : "" };
          return { ...prefillConsultation(current, { prenatal_record: { ...pregnancy, estimated_delivery_date: pregnancy.official_edd } }, touchedHistoryFields.current),
            lmp_date: pregnancy.lmp_date || "", expected_delivery_date: pregnancy.official_edd || "" };
        });
      } catch (error) { if (!cancelled) setPregnancyContext({ patientId, pregnancy: null, error: error.message, loading: false }); }
    });
    return () => { cancelled = true; };
  }, [form.patient_id, isPrenatal, loading, editCaseId, editingCase?.prenatal_record?.pregnancy_id, pregnancyIdFromUrl]);
  const pregnancyLoading = isPrenatal && Boolean(form.patient_id) && (pregnancyContext.patientId !== String(form.patient_id) || pregnancyContext.loading);

  const prenatalRiskAssessment = (() => {
    const reasons = [];
    const urgentReasons = [];
    const visitDate = form.consultation_date
      ? new Date(form.consultation_date)
      : new Date();
    const age = calculateAge(selectedPatient?.birth_date, visitDate);
    const { systolic, diastolic } = parseBloodPressure(form.blood_pressure);
    const fetuses = Number(form.number_of_fetuses || 1);

    if (form.vaginal_bleeding) urgentReasons.push("Vaginal bleeding");
    if (form.severe_headache) urgentReasons.push("Severe or persistent headache");
    if (form.blurred_vision) urgentReasons.push("Blurred vision");
    if (form.severe_abdominal_pain) urgentReasons.push("Severe abdominal pain");
    if (["Decreased", "Absent"].includes(form.fetal_movement)) {
      urgentReasons.push(`${form.fetal_movement} fetal movement`);
    }
    if (systolic >= 140 || diastolic >= 90) {
      urgentReasons.push(`Elevated blood pressure (${form.blood_pressure})`);
    }
    if (form.edema === "Severe") urgentReasons.push("Severe edema");

    if (age !== null && age >= 35) reasons.push(`Maternal age ${age}`);
    if (age !== null && age < 18) reasons.push(`Maternal age ${age}`);
    if (fetuses > 1) reasons.push("Multiple pregnancy");
    if (form.chronic_hypertension) reasons.push("Chronic hypertension");
    if (form.diabetes) reasons.push("Diabetes");
    if (form.previous_preeclampsia) reasons.push("Previous preeclampsia");
    if (form.kidney_disease) reasons.push("Kidney disease");
    if (form.autoimmune_disease) reasons.push("Autoimmune disease");
    if (Number(form.abortion_count || 0) >= 2) reasons.push("Two or more previous pregnancy losses");
    if (form.edema === "Moderate") reasons.push("Moderate edema");

    const allReasons = [...urgentReasons, ...reasons];
    let level = "Low Risk";
    if (urgentReasons.length || reasons.length >= 2) level = "High Risk";
    else if (reasons.length === 1) level = "Moderate Risk";

    return { level, reasons: allReasons, urgent: urgentReasons.length > 0 };
  })();

  useEffect(() => {
    if (!isPrenatal || (!form.lmp_date && !pregnancyContext.pregnancy?.official_edd)) return;
    const officialEdd = pregnancyContext.patientId === String(form.patient_id) ? pregnancyContext.pregnancy?.official_edd : null;
    const datingLmp = officialEdd ? new Date(Date.parse(officialEdd) - 280 * 86400000).toISOString().slice(0, 10) : form.lmp_date;
    const gestationalAge = calculateGestationalAge(
      datingLmp,
      form.consultation_date,
    );
    const estimatedDeliveryDate = calculateEstimatedDeliveryDate(form.lmp_date);

    setForm((current) => ({
      ...current,
      expected_delivery_date: officialEdd || current.expected_delivery_date || estimatedDeliveryDate,
      gestational_weeks: gestationalAge.weeks,
      gestational_days: gestationalAge.days,
    }));
  }, [isPrenatal, form.lmp_date, form.consultation_date, form.patient_id, pregnancyContext]);

  useEffect(() => {
    if (!isPrenatal) return;
    setForm((current) => ({
      ...current,
      risk_level: prenatalRiskAssessment.level,
      risk_reasons: prenatalRiskAssessment.reasons,
    }));
  }, [
    isPrenatal,
    prenatalRiskAssessment.level,
    prenatalRiskAssessment.reasons.join("|"),
  ]);

  const filteredPatients = patients
    .filter((patient) => {
      const searchValue = patientSearch
        .trim()
        .toLowerCase();

      if (!searchValue) {
        return true;
      }

      const fullName = [
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const reversedName = [
        patient.last_name,
        patient.first_name,
        patient.middle_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const patientNumber = String(
        patient.patient_number || "",
      ).toLowerCase();

      return (
        fullName.includes(searchValue) ||
        reversedName.includes(searchValue) ||
        patientNumber.includes(searchValue)
      );
    })
    .slice(0, 8);

  const selectPatient = (patient) => {
    if (String(form.patient_id) !== String(patient.id)) {
      pendingCase.current = null;
      touchedHistoryFields.current = new Set();
      setPrescription({ issued_date: today(), diagnosis: "", notes: "", items: [{ ...blankMedicine }] });
      setLaboratory({ requested_date: today(), indication: "", notes: "", items: [], other_test: "" });
    }
    setForm((currentForm) => ({
      ...(String(currentForm.patient_id) === String(patient.id) ? currentForm : {
        ...createInitialForm(String(patient.id)), service_id: currentForm.service_id, service_type: currentForm.service_type,
      }),
      patient_id: String(patient.id),
    }));

    setPatientSearch("");
    setShowPatientResults(false);
  };

  const clearSelectedPatient = () => {
    pendingCase.current = null;
    touchedHistoryFields.current = new Set();
    setForm((currentForm) => ({
      ...createInitialForm(""),
      service_id: currentForm.service_id,
      service_type: currentForm.service_type,
      patient_id: "",
    }));

    setPatientSearch("");
    setShowPatientResults(true);
  };

  const set = (key) => (event) => {
    touchedHistoryFields.current.add(key);
    setForm((currentForm) => ({
      ...currentForm,
      [key]: event.target.value,
      ...(key === "lmp_date" ? { expected_delivery_date: calculateEstimatedDeliveryDate(event.target.value) } : {}),
    }));
  };

  const setCheck = (key) => (event) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: event.target.checked,
    }));
  };

  const setPrescriptionField =
    (key) => (event) => {
      setPrescription((current) => ({
        ...current,
        [key]: event.target.value,
      }));
    };

  const setLaboratoryField =
    (key) => (event) => {
      setLaboratory((current) => ({
        ...current,
        [key]: event.target.value,
      }));
    };

  const updateMedicine = (
    index,
    key,
    value,
  ) => {
    setPrescription((current) => ({
      ...current,

      items: current.items.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [key]: value,
              }
            : item,
      ),
    }));
  };

  const addMedicine = () => {
    setPrescription((current) => ({
      ...current,

      items: [
        ...current.items,
        { ...blankMedicine },
      ],
    }));
  };

  const removeMedicine = (index) => {
    setPrescription((current) => ({
      ...current,

      items:
        current.items.length === 1
          ? [{ ...blankMedicine }]
          : current.items.filter(
              (_, itemIndex) =>
                itemIndex !== index,
            ),
    }));
  };

  const toggleLabProcedure = (testName) => {
    setLaboratory((current) => {
      const isSelected =
        current.items.some(
          (item) =>
            item.test_name === testName,
        );

      return {
        ...current,

        items: isSelected
          ? current.items.filter(
              (item) =>
                item.test_name !== testName,
            )
          : [
              ...current.items,
              {
                test_name: testName,
              },
            ],
      };
    });
  };

  const setOtherLabTest = (event) => {
    setLaboratory((current) => ({
      ...current,
      other_test: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (saving || historyLoading || pregnancyLoading || (editCaseId && (!editingCase || editLoadFailed))) return;
    setSaving(true);
    setResult("");

    try {
      if (!form.patient_id) {
        throw new Error(
          "Please select a patient.",
        );
      }

      if (!form.chief_complaint.trim()) {
        throw new Error(
          "Chief complaint is required.",
        );
      }

      if (isPrenatal) {
        if (pregnancyContext.error) throw new Error(pregnancyContext.error);
        if (!form.service_id) throw new Error("Select an active prenatal service before saving.");
        if (!form.lmp_date && !pregnancyContext.pregnancy?.official_edd) {
          throw new Error(
            "Last menstrual period is required for a prenatal consultation.",
          );
        }

        if (
          form.gestational_weeks === "" ||
          Number(form.gestational_weeks) < 0
        ) {
          throw new Error(
            "Please enter the gestational age in weeks.",
          );
        }

        if (
          form.gestational_days !== "" &&
          (Number(form.gestational_days) < 0 ||
            Number(form.gestational_days) > 6)
        ) {
          throw new Error(
            "Gestational days must be between 0 and 6.",
          );
        }
      }

      const diagnoses = form.diagnoses
        .split("\n")
        .map((diagnosis) =>
          diagnosis.trim(),
        )
        .filter(Boolean);

      const body = {
        ...form,
        pregnancy_id: isPrenatal ? pregnancyContext.pregnancy?.id : undefined,
        service_fee: undefined,

        patient_id: Number(
          form.patient_id,
        ),

        doctor_id:
          currentUser.id || null,

        appointment_id:
          form.appointment_id ||
          appointmentIdFromUrl
            ? Number(
                form.appointment_id ||
                  appointmentIdFromUrl,
              )
            : null,

        service_type:
          form.service_type ||
          appointment?.service ||
          appointment?.service_type ||
          appointment?.type_of_service ||
          null,

        service_id: Number(
          form.service_id || appointment?.service_id,
        ),

        diagnoses,
      };

      if (editCaseId) {
        delete body.service_type;
        delete body.service_id;
        delete body.appointment_id;
      }
      const updatingId = editCaseId || pendingCase.current?.id;
      if (updatingId) { delete body.service_type; delete body.service_id; delete body.appointment_id; }
      const savedCase = await api(updatingId ? `/cases/${updatingId}` : "/cases", {
        method: updatingId ? "PATCH" : "POST", body: JSON.stringify(body),
      });
      const record = editCaseId ? editingCase : pendingCase.current || savedCase;
      if (!editCaseId) pendingCase.current = record;

      let prenatalRecord = null;

      if (isPrenatal) {
        prenatalRecord = await api(
          editCaseId && editingCase?.prenatal_record?.id ? `/prenatal-records/${editingCase.prenatal_record.id}` : "/prenatal-records",
          {
            method: editCaseId && editingCase?.prenatal_record?.id ? "PUT" : "POST",
            body: JSON.stringify({
              patient_id: Number(form.patient_id),
              pregnancy_id: pregnancyContext.pregnancy?.id || record.pregnancy_id,
              consultation_case_id: record.id,
              appointment_id:
                form.appointment_id ||
                appointmentIdFromUrl
                  ? Number(
                      form.appointment_id ||
                        appointmentIdFromUrl,
                    )
                  : null,
              doctor_id: currentUser.id || null,
              visit_date: form.consultation_date,
              service_type: form.service_type,
              lmp_date: form.lmp_date || null,
              estimated_delivery_date:
                  form.expected_delivery_date || null,
              gestational_weeks:
                form.gestational_weeks !== ""
                  ? Number(form.gestational_weeks)
                  : null,
              gestational_days:
                form.gestational_days !== ""
                  ? Number(form.gestational_days)
                  : 0,
              gravida:
                form.gravida !== ""
                  ? Number(form.gravida)
                  : null,
              para:
                form.para !== ""
                  ? Number(form.para)
                  : null,
              abortion_count:
                form.abortion_count !== ""
                  ? Number(form.abortion_count)
                  : null,
              living_children:
                form.living_children !== ""
                  ? Number(form.living_children)
                  : null,
              number_of_fetuses:
                form.number_of_fetuses !== ""
                  ? Number(form.number_of_fetuses)
                  : 1,
              blood_pressure:
                form.blood_pressure || null,
              temperature_c:
                form.temperature_c !== ""
                  ? Number(form.temperature_c)
                  : null,
              weight_kg:
                form.weight_kg !== ""
                  ? Number(form.weight_kg)
                  : null,
              height_cm:
                form.height_cm !== ""
                  ? Number(form.height_cm)
                  : null,
              fundal_height_cm:
                form.fundal_height_cm !== ""
                  ? Number(form.fundal_height_cm)
                  : null,
              fetal_heart_rate:
                form.fetal_heart_rate !== ""
                  ? Number(form.fetal_heart_rate)
                  : null,
              fetal_movement:
                form.fetal_movement || null,
              fetal_presentation:
                form.fetal_presentation || null,
              edema: form.edema || null,
              risk_level:
                editingCase?.prenatal_record?.risk_level || form.risk_level || "Low Risk",
              risk_reasons: form.risk_reasons,
              assessment:
                diagnoses.join(", ") || null,
              treatment:
                form.treatment.trim() || null,
              notes:
                form.prenatal_notes.trim() ||
                form.doctor_notes.trim() ||
                null,
              next_visit_date:
                form.next_prenatal_visit ||
                form.follow_up_date ||
                null,
            }),
          },
        );
      }

      if (editCaseId && prenatalRecord) {
        setEditingCase((current) => ({ ...current, prenatal_record: {
          ...current.prenatal_record,
          id: current.prenatal_record?.id || prenatalRecord.id,
        } }));
      }


      const medicineItems =
        prescription.items
          .map((item) => ({
            medicine_name:
              item.medicine_name.trim(),

            dosage:
              item.dosage.trim(),

            frequency:
              item.frequency.trim(),

            duration:
              item.duration.trim(),

            instructions:
              item.instructions.trim(),
          }))
          .filter(
            (item) =>
              item.medicine_name,
          );

      if (medicineItems.length) {
        await api("/prescriptions", {
          method: "POST",

          body: JSON.stringify({
            patient_id: Number(
              form.patient_id,
            ),

            consultation_case_id:
              record.id,

            issued_date:
              prescription.issued_date,

            diagnosis:
              prescription.diagnosis.trim() ||
              diagnoses.join(", ") ||
              null,

            notes:
              prescription.notes.trim() ||
              null,

            items: medicineItems,
          }),
        });
        setPrescription({ issued_date: today(), diagnosis: "", notes: "", items: [{ ...blankMedicine }] });
      }

      const labItems = [
        ...laboratory.items,

        ...(laboratory.other_test.trim()
          ? [
              {
                test_name:
                  laboratory.other_test.trim(),
              },
            ]
          : []),
      ]
        .map((item) => ({
          test_name:
            item.test_name.trim(),
        }))
        .filter(
          (item) => item.test_name,
        );

      if (labItems.length) {
        await api(
          "/laboratory-requests",
          {
            method: "POST",

            body: JSON.stringify({
              patient_id: Number(
                form.patient_id,
              ),

              consultation_case_id:
                record.id,

              requested_date:
                laboratory.requested_date,

              indication:
                laboratory.indication.trim() ||
                null,

              notes:
                laboratory.notes.trim() ||
                null,

              items: labItems,
            }),
          },
        );
      }

      if (labItems.length) setLaboratory({ requested_date: today(), indication: "", notes: "", items: [], other_test: "" });

      if (
        !editCaseId && appointmentIdFromUrl &&
        appointment
      ) {
        await api(
          `/appointments/${appointmentIdFromUrl}`,
          {
            method: "PUT",

            body: JSON.stringify({
              patient_id:
                appointment.patient_id,

              service_id:
                appointment.service_id ||
                form.service_id,

              service:
                appointment.service,

              appointment_date:
                appointment.appointment_date,

              status: "Completed",
            }),
          },
        );
      }

      const extras = [
        isPrenatal && prenatalRecord
          ? "prenatal record"
          : "",

        medicineItems.length
          ? "prescription"
          : "",

        labItems.length
          ? "laboratory request"
          : "",
      ].filter(Boolean);

      setResult(
        `Consultation saved as ${
          record.case_number
        }${
          extras.length
            ? ` with ${extras.join(
                " and ",
              )}`
            : ""
        }.`,
      );

      if (!editCaseId) localStorage.removeItem(draftKey);

      setTimeout(() => {
        if (isPrenatal && !editCaseId) {
          navigate(
            `/prenatal-records?patient=${form.patient_id}&pregnancy=${
              prenatalRecord?.pregnancy_id || record.pregnancy_id || ""
            }`,
          );
          return;
        }

        navigate(`/cases/${record.id}`);
      }, 800);
    } catch (error) {
      setResult(error.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key,
    label,
    type = "text",
    options = {},
  ) => (
    <label className="text-sm font-medium text-slate-600">
      {label}

      <input
        type={type}
        readOnly={key === "lmp_date" && Boolean(pregnancyContext.pregnancy)}
        value={form[key]}
        onChange={set(key)}
        min={options.min}
        max={options.max}
        step={options.step}
        required={options.required}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activeItem="Consultations" />

        <div className="flex flex-1 items-center justify-center">
          <p className="text-slate-500">
            Loading consultation form…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeItem="Consultations" />

      <div className="min-w-0 flex-1">
        <header className="m-4 rounded-3xl bg-linear-to-r from-teal-700 to-teal-500 p-6 text-white sm:m-6">
          <Link
            to="/appointments"
            className="inline-flex items-center gap-2 text-sm text-teal-100 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to appointments
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-teal-100">
                Clinical encounter
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                New consultation case
              </h1>

              <p className="mt-2 text-teal-100">
                Consultation, prescription,
                and laboratory request in one
                page.
              </p>
            </div>

            {appointmentIdFromUrl && (
              <div className="rounded-2xl bg-white/15 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-teal-100">
                  Appointment
                </p>

                <p className="mt-1 font-semibold">
                  #{appointmentIdFromUrl}
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 pb-8 sm:px-6">
          {editCaseId && editingCase && <section className="mx-auto mb-6 max-w-6xl rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-800">Existing prescriptions and laboratory requests</h2>
            <p className="mt-1 text-sm text-slate-500">Add any new medicines or tests in the form below. Existing documents and lab results remain in this consultation.</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {(editingCase.prescriptions || []).map((rx) => <p key={`rx-${rx.id}`}><strong>{rx.prescription_number}:</strong> {rx.items?.map((item) => [item.medicine_name, item.dosage, item.frequency, item.duration, item.instructions].filter(Boolean).join(" ? ")).join("; ")}</p>)}
              {(editingCase.laboratory_requests || []).map((lab) => <p key={`lab-${lab.id}`}><strong>{lab.request_number}:</strong> {lab.items?.map((item) => item.test_name).join(", ")}</p>)}
            </div>
          </section>}
          <form
            onSubmit={submit}
            className="consultation-form mx-auto max-w-6xl space-y-6"
          >
            {!editCaseId && form.patient_id && <div role="status" className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
              {historyLoading ? "Loading the patient's most recent consultation..." : historyStatus.error || (
                previousConsultation && String(previousConsultation.patient_id) === String(form.patient_id)
                  ? <><strong>History from {previousConsultation.case_number}</strong> ({previousConsultation.consultation_date?.replace("T", " ")}). Review the pre-filled history for this visit. <Link to={`/cases/${previousConsultation.id}`} className="font-semibold underline">View previous consultation</Link></>
                  : "No previous consultation found. Enter the details for this visit."
              )}
            </div>}
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-50 p-3">
                  <Stethoscope className="text-teal-600" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {editCaseId ? `Edit consultation ${editingCase?.case_number || ""}` : "Consultation"}
                  </h2>

                  <p className="text-sm text-slate-500">
                    Record the patient’s
                    clinical encounter.
                  </p>
                </div>
              </div>

              {selectedPatient &&
                appointmentIdFromUrl && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700">
                        <UserRound
                          size={21}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                          Appointed patient
                        </p>

                        <p className="font-bold text-slate-800">
                          {
                            selectedPatient.last_name
                          }
                          ,{" "}
                          {
                            selectedPatient.first_name
                          }{" "}
                          {selectedPatient.middle_name ||
                            ""}
                        </p>

                        <p className="text-sm text-slate-500">
                          {
                            selectedPatient.patient_number
                          }
                        </p>

                        {form.service_type && (
                          <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700">
                            Service:{" "}
                            {
                              form.service_type
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-700">
                      <CheckCircle2
                        size={15}
                      />

                      Selected from appointment
                    </span>
                  </div>
                )}

              <div className="relative mt-6">
                <label className="text-sm font-medium text-slate-600">
                  Search patient
                </label>

                <div className="relative mt-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={patientSearch}
                    disabled={Boolean(
                      appointmentIdFromUrl || editCaseId,
                    )}
                    placeholder="Search by patient name or patient number"
                    autoComplete="off"
                    onFocus={() => {
                      if (
                        !appointmentIdFromUrl && !editCaseId
                      ) {
                        setShowPatientResults(
                          true,
                        );
                      }
                    }}
                    onChange={(event) => {
                      setPatientSearch(
                        event.target.value,
                      );

                      setShowPatientResults(
                        true,
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {!appointmentIdFromUrl && !editCaseId &&
                  showPatientResults && (
                    <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      {filteredPatients.length >
                      0 ? (
                        filteredPatients.map(
                          (patient) => (
                            <button
                              key={
                                patient.id
                              }
                              type="button"
                              onClick={() =>
                                selectPatient(
                                  patient,
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                <UserRound
                                  size={
                                    19
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">
                                  {
                                    patient.last_name
                                  }
                                  ,{" "}
                                  {
                                    patient.first_name
                                  }{" "}
                                  {patient.middle_name ||
                                    ""}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {
                                    patient.patient_number
                                  }
                                </p>
                              </div>
                            </button>
                          ),
                        )
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <UserRound
                            size={28}
                            className="mx-auto text-slate-300"
                          />

                          <p className="mt-2 text-sm font-medium text-slate-600">
                            No patient found
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Try another name or
                            patient number.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-600">
                  Selected patient
                </label>

                <div className="mt-1 flex min-h-20.5 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  {selectedPatient ? (
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                        <UserRound
                          size={22}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-slate-800">
                          {
                            selectedPatient.last_name
                          }
                          ,{" "}
                          {
                            selectedPatient.first_name
                          }{" "}
                          {selectedPatient.middle_name ||
                            ""}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Patient No.:{" "}
                          {
                            selectedPatient.patient_number
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                        <UserRound
                          size={22}
                        />
                      </div>

                      <p className="text-sm">
                        No patient selected
                      </p>
                    </div>
                  )}

                  {selectedPatient &&
                    !appointmentIdFromUrl && !editCaseId && (
                      <button
                        type="button"
                        onClick={
                          clearSelectedPatient
                        }
                        className="shrink-0 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Clear patient
                      </button>
                    )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-600">
  Type of Service

  <input
    type="search"
    value={serviceSearch}
    onChange={(event) => setServiceSearch(event.target.value)}
    placeholder="Search active services"
    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
  />

  <select
    disabled={Boolean(editCaseId)}
    value={form.service_id}
    onChange={(event) => {
      const serviceId = event.target.value;
      setForm((current) => {
        const next = { ...current, service_id: serviceId,
          service_type: serviceTypes.find((service) => String(service.id) === serviceId)?.service_name || "" };
        return !editCaseId && previousConsultation && String(previousConsultation.patient_id) === String(current.patient_id)
          ? prefillConsultation(next, { ...previousConsultation, prenatal_record: null }, touchedHistoryFields.current) : next;
      });
    }}
    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
  >
    <option value="">Select service</option>
    {editCaseId && !serviceTypes.some((service) => String(service.id) === String(form.service_id)) && <option value={form.service_id}>{form.service_type}</option>}

   {serviceTypes.filter((service) => service.service_name.toLowerCase().includes(serviceSearch.trim().toLowerCase())).map((service) => (
  <option key={service.id} value={service.id}>
    {service.service_name}
  </option>
))}
  </select>



  {!serviceTypes.length && (
    <span className="mt-1 block text-xs text-amber-600">
      Add an active service in Tools before creating a consultation.
    </span>
  )}

  {appointmentIdFromUrl && (
    <span className="mt-1 block text-xs text-teal-600">
      Automatically loaded from the appointment; you may change it before saving.
    </span>
  )}
</label>

                {field(
                  "consultation_date",
                  "Consultation date and time",
                  "datetime-local",
                  {
                    required: true,
                  },
                )}

                {field(
                  "follow_up_date",
                  "Follow-up date",
                  "date",
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Chief complaint

                  <textarea
                    required
                    rows="4"
                    value={
                      form.chief_complaint
                    }
                    onChange={set(
                      "chief_complaint",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  History of present illness

                  <textarea
                    rows="4"
                    value={
                      form.history_present_illness
                    }
                    onChange={set(
                      "history_present_illness",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <h3 className="mt-7 font-bold text-slate-700">
                Vital signs
              </h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {field(
                  "blood_pressure",
                  "Blood pressure",
                )}

                {field(
                  "temperature_c",
                  "Temperature °C",
                  "number",
                  {
                    min: "0",
                    step: "0.1",
                  },
                )}

                {field(
                  "weight_kg",
                  "Weight kg",
                  "number",
                  {
                    min: "0",
                    step: "0.1",
                  },
                )}

                {field(
                  "height_cm",
                  "Height cm",
                  "number",
                  {
                    min: "0",
                    step: "0.1",
                  },
                )}
              </div>

              {isPrenatal && (
                <section className="mt-7 rounded-3xl border border-pink-100 bg-pink-50/50 p-5">
                  {form.patient_id && <div role="status" className="mb-4 rounded-xl bg-white p-3 text-sm text-slate-700">
                    {pregnancyLoading ? "Loading current pregnancy..." : pregnancyContext.error || (pregnancyContext.pregnancy
                      ? `This visit will be saved under ${pregnancyContext.pregnancy.pregnancy_number}. Official EDD source: ${pregnancyContext.pregnancy.edd_source}.`
                      : "A new pregnancy record will be created with this first visit.")}
                    {!pregnancyLoading && <Link className="ml-2 font-semibold text-pink-700 underline" to={pregnancyContext.pregnancy ? `/prenatal-records?pregnancy=${pregnancyContext.pregnancy.id}` : `/prenatal-records?patient=${form.patient_id}`}>Review pregnancy / correct dates</Link>}
                  </div>}
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                      🤰
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800">
                        Prenatal assessment
                      </h3>

                      <p className="text-sm text-slate-500">
                        These details will be saved to the patient&apos;s prenatal record.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {field(
                      "lmp_date",
                      "Last menstrual period (LMP)",
                      "date",
                      { required: !pregnancyContext.pregnancy?.official_edd },
                    )}

                    <label className="text-sm font-medium text-slate-600">
                      Estimated delivery date (EDD)
                      <input
                        type="date"
                        value={form.expected_delivery_date}
                        readOnly
                        className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700"
                      />
                      <span className="mt-1 block text-xs text-slate-500">
                        Loaded from the previous visit when available; recalculated when the LMP changes.
                      </span>
                    </label>

                    {field(
                      "gestational_weeks",
                      "Gestational age — weeks",
                      "number",
                      { min: "0", required: true },
                    )}

                    {field(
                      "gestational_days",
                      "Additional days",
                      "number",
                      { min: "0", max: "6" },
                    )}
                  </div>

                  <h4 className="mt-6 font-semibold text-slate-700">
                    Obstetric history
                  </h4>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {field("gravida", "Gravida", "number", { min: "0" })}
                    {field("para", "Para", "number", { min: "0" })}
                    {field("abortion_count", "Abortions", "number", { min: "0" })}
                    {field("living_children", "Living children", "number", { min: "0" })}
                    {field("number_of_fetuses", "Number of fetuses", "number", { min: "1" })}
                  </div>

                  <h4 className="mt-6 font-semibold text-slate-700">
                    Fetal assessment
                  </h4>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {field(
                      "fundal_height_cm",
                      "Fundal height (cm)",
                      "number",
                      { min: "0", step: "0.1" },
                    )}

                    {field(
                      "fetal_heart_rate",
                      "Fetal heart rate (bpm)",
                      "number",
                      { min: "0" },
                    )}

                    <label className="text-sm font-medium text-slate-600">
                      Fetal movement
                      <select
                        value={form.fetal_movement}
                        onChange={set("fetal_movement")}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                      >
                        <option value="">Select fetal movement</option>
                        <option value="Not Yet Perceived">Not Yet Perceived</option>
                        <option value="Present">Present</option>
                        <option value="Decreased">Decreased</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </label>

                    <label className="text-sm font-medium text-slate-600">
                      Fetal presentation
                      <select
                        value={form.fetal_presentation}
                        onChange={set("fetal_presentation")}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                      >
                        <option value="">Select presentation</option>
                        <option value="Not Yet Determined">Not Yet Determined</option>
                        <option value="Cephalic">Cephalic</option>
                        <option value="Breech">Breech</option>
                        <option value="Transverse">Transverse</option>
                        <option value="Oblique">Oblique</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label className="text-sm font-medium text-slate-600">
                      Edema
                      <select
                        value={form.edema}
                        onChange={set("edema")}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                      >
                        <option value="">Select edema status</option>
                        <option value="None">None</option>
                        <option value="Mild">Mild</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Severe">Severe</option>
                      </select>
                    </label>

                    <label className="text-sm font-medium text-slate-600">
                      System risk screening
                      <input
                        value={form.risk_level}
                        readOnly
                        className={`mt-1 w-full cursor-not-allowed rounded-xl border px-3 py-2.5 font-semibold ${
                          form.risk_level === "High Risk"
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : form.risk_level === "Moderate Risk"
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700"
                        }`}
                      />
                      <span className="mt-1 block text-xs text-slate-500">
                        Screening aid only; the doctor must confirm the assessment.
                      </span>
                    </label>

                    {field(
                      "next_prenatal_visit",
                      "Next prenatal visit",
                      "date",
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="font-semibold text-slate-700">
                      Risk factors and warning signs
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Select every condition reported or observed during this visit.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["vaginal_bleeding", "Vaginal bleeding"],
                        ["severe_headache", "Severe or persistent headache"],
                        ["blurred_vision", "Blurred vision"],
                        ["severe_abdominal_pain", "Severe abdominal pain"],
                        ["chronic_hypertension", "Chronic hypertension"],
                        ["diabetes", "Diabetes"],
                        ["previous_preeclampsia", "Previous preeclampsia"],
                        ["kidney_disease", "Kidney disease"],
                        ["autoimmune_disease", "Autoimmune disease"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 hover:bg-pink-50"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(form[key])}
                            onChange={setCheck(key)}
                            className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className={`mt-4 rounded-xl p-4 ${
                      prenatalRiskAssessment.urgent
                        ? "bg-rose-50 text-rose-800"
                        : form.risk_level === "Moderate Risk"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-emerald-50 text-emerald-800"
                    }`}>
                      <p className="font-semibold">
                        Result: {form.risk_level}
                      </p>
                      {form.risk_reasons.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {form.risk_reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm">
                          No configured risk factor was detected from the entered data.
                        </p>
                      )}
                      {prenatalRiskAssessment.urgent && (
                        <p className="mt-3 text-sm font-semibold">
                          Warning sign detected. The patient needs prompt clinical assessment.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="mt-5 block text-sm font-medium text-slate-600">
                    Prenatal findings and notes
                    <textarea
                      rows="4"
                      value={form.prenatal_notes}
                      onChange={set("prenatal_notes")}
                      placeholder="Additional maternal and fetal observations"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                    />
                  </label>
                </section>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Diagnosis, one per line

                  <textarea
                    rows="5"
                    value={form.diagnoses}
                    onChange={set(
                      "diagnoses",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Treatment

                  <textarea
                    rows="5"
                    value={form.treatment}
                    onChange={set(
                      "treatment",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Doctor&apos;s notes

                <textarea
                  rows="4"
                  value={form.doctor_notes}
                  onChange={set(
                    "doctor_notes",
                  )}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-pink-50 p-3">
                    <Pill className="text-pink-600" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Prescription
                    </h2>

                    <p className="text-sm text-slate-500">
                      Leave all medicine names
                      blank when no prescription
                      is needed.
                    </p>
                  </div>
                </div>


              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Issued date

                  <input
                    type="date"
                    value={
                      prescription.issued_date
                    }
                    onChange={setPrescriptionField(
                      "issued_date",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Prescription diagnosis

                  <input
                    value={
                      prescription.diagnosis
                    }
                    onChange={setPrescriptionField(
                      "diagnosis",
                    )}
                    placeholder="Uses consultation diagnosis when blank"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {prescription.items.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-700">
                          Medicine{" "}
                          {index + 1}
                        </h3>

                        <button
                          type="button"
                          onClick={() =>
                            removeMedicine(
                              index,
                            )
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2
                            size={17}
                          />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                        {[
                          [
                            "medicine_name",
                            "Medicine name",
                          ],
                          [
                            "dosage",
                            "Dosage",
                          ],
                          [
                            "frequency",
                            "Frequency",
                          ],
                          [
                            "duration",
                            "Duration",
                          ],
                          [
                            "instructions",
                            "Instructions",
                          ],
                        ].map(
                          ([
                            key,
                            label,
                          ]) => (
                            <label
                              key={key}
                              className="text-sm font-medium text-slate-600"
                            >
                              {label}

                              <input
                                value={
                                  item[
                                    key
                                  ]
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateMedicine(
                                    index,
                                    key,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                              />
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={addMedicine}
                  className="inline-flex items-center gap-2 rounded-xl border border-pink-200 px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
                >
                  <Plus size={16} />
                  Add medicine
                </button>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Prescription notes

                <textarea
                  rows="3"
                  value={prescription.notes}
                  onChange={setPrescriptionField(
                    "notes",
                  )}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                />
              </label>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3">
                  <FlaskConical className="text-blue-600" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Laboratory request
                  </h2>

                  <p className="text-sm text-slate-500">
                    Check the laboratory
                    procedures requested for the
                    patient.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Requested date

                  <input
                    type="date"
                    value={
                      laboratory.requested_date
                    }
                    onChange={setLaboratoryField(
                      "requested_date",
                    )}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Clinical indication

                  <input
                    value={
                      laboratory.indication
                    }
                    onChange={setLaboratoryField(
                      "indication",
                    )}
                    placeholder="Reason for requesting the procedure"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                {laboratoryProcedures.map(
                  (group) => (
                    <div
                      key={group.category}
                      className="rounded-2xl border border-slate-200 p-3"
                    >
                      <h3 className="font-bold text-slate-700">
                        {group.category}
                      </h3>

                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {group.tests.map(
                          (testName) => {
                            const checked =
                              laboratory.items.some(
                                (
                                  item,
                                ) =>
                                  item.test_name ===
                                  testName,
                              );

                            return (
                              <label
                                key={
                                  testName
                                }
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition ${
                                  checked
                                    ? "border-blue-300 bg-blue-50 text-blue-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    checked
                                  }
                                  onChange={() =>
                                    toggleLabProcedure(
                                      testName,
                                    )
                                  }
                                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />

                                <span className="font-medium">
                                  {
                                    testName
                                  }
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Other laboratory procedure

                <input
                  value={
                    laboratory.other_test
                  }
                  onChange={setOtherLabTest}
                  placeholder="Enter another procedure not listed above"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">
                  Selected procedures:{" "}
                  {laboratory.items.length +
                    (laboratory.other_test.trim()
                      ? 1
                      : 0)}
                </p>

                {laboratory.items.length >
                  0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {laboratory.items.map(
                      (item) => (
                        <span
                          key={
                            item.test_name
                          }
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                        >
                          {
                            item.test_name
                          }
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-600">
                Laboratory notes

                <textarea
                  rows="3"
                  value={laboratory.notes}
                  onChange={setLaboratoryField(
                    "notes",
                  )}
                  placeholder="Additional instructions for the laboratory"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </section>

            {result && (
              <p
                className={`rounded-xl p-4 text-sm ${
                  result
                    .toLowerCase()
                    .includes("saved")
                    ? "bg-teal-50 text-teal-800"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {result}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to={editCaseId ? `/cases/${editCaseId}` : prenatalFromUrl ? "/prenatal-records" : "/appointments"}
                onClick={() =>
                  !editCaseId && localStorage.removeItem(draftKey)
                }
                className="rounded-xl px-5 py-3 font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving || historyLoading || pregnancyLoading || (isPrenatal && Boolean(pregnancyContext.error)) || (Boolean(editCaseId) && (!editingCase || editLoadFailed))}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />

                {saving
                  ? "Saving all records..."
                  : editCaseId ? "Save changes and new requests" : "Save consultation and requests"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

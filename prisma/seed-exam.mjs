import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const questions = [
  {
    text: '¿Cuál es la característica clínica dominante de los errores innatos de inmunidad del grupo de disregulación inmune (PIRD), en contraste con las inmunodeficiencias primarias clásicas (PIDD)?',
    options: [
      { text: 'Linfopenia profunda al nacimiento', isCorrect: false },
      { text: 'Infecciones recurrentes por gérmenes oportunistas', isCorrect: false },
      { text: 'Autoinmunidad múltiple, linfoproliferación o hiperinflamación', isCorrect: true },
      { text: 'Hipogammaglobulinemia aislada', isCorrect: false },
    ],
  },
  {
    text: 'En relación con las inmunoglobulinas es cierto que:',
    options: [
      { text: 'Sólo tienen funciones protectoras por lo que su alteración se traduce exclusivamente en un mayor riesgo de infecciones', isCorrect: false },
      { text: 'La terapia de reemplazo con inmunoglobulina endovenosa es una de las principales herramientas terapéuticas de los pacientes con errores innatos de la inmunidad', isCorrect: true },
      { text: 'Los productos de inmunoglobulinas se fabrican a partir de síntesis en laboratorio', isCorrect: false },
      { text: 'Tiene una vida media prolongada de hasta 6 meses', isCorrect: false },
    ],
  },
  {
    text: 'Un escolar presenta episodios recurrentes de fiebre desde periodo lactante, acompañados de exantema urticarial y elevación de reactantes inflamatorios. Los estudios microbiológicos son negativos y entre las crisis se encuentra completamente asintomático, con normalización de los parámetros inflamatorios. Este cuadro es más compatible con:',
    options: [
      { text: 'Inmunodeficiencia predominantemente de anticuerpos', isCorrect: false },
      { text: 'Síndrome autoinflamatorio', isCorrect: true },
      { text: 'Inmunodeficiencia combinada grave', isCorrect: false },
      { text: 'Síndrome linfoproliferativo autoinmune', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de las siguientes manifestaciones cutáneas debería alertar más sobre un posible error innato de la inmunidad?',
    options: [
      { text: 'Acné inflamatorio adolescente', isCorrect: false },
      { text: 'Melasma facial', isCorrect: false },
      { text: 'Dermatitis atópica leve', isCorrect: false },
      { text: 'Verrugas extensas, numerosas y persistentes', isCorrect: true },
      { text: 'Queratosis pilaris', isCorrect: false },
    ],
  },
  {
    text: '¿Cuáles son los patógenos característicamente asociados a los defectos de la inmunidad humoral?',
    options: [
      { text: 'Micobacterias y Salmonella spp.', isCorrect: false },
      { text: 'Virus herpes y enterovirus', isCorrect: false },
      { text: 'Candida spp. y Pneumocystis jirovecii', isCorrect: false },
      { text: 'Streptococcus pneumoniae, Haemophilus influenzae y Neisseria meningitidis', isCorrect: true },
      { text: 'Toxoplasma gondii y Cryptosporidium spp.', isCorrect: false },
    ],
  },
  {
    text: 'Respecto a los defectos congénitos de los fagocitos, ¿cuál de las siguientes situaciones clínicas debe hacer sospechar este tipo de inmunodeficiencia primaria?',
    options: [
      { text: 'Infecciones respiratorias virales recurrentes autolimitadas en un escolar sano', isCorrect: false },
      { text: 'Infecciones bacterianas y fúngicas recurrentes con compromiso de piel, partes blandas, hueso o linfonodos', isCorrect: true },
      { text: 'Diarrea crónica asociada a hipogammaglobulinemia aislada', isCorrect: false },
      { text: 'Mononucleosis infecciosa grave por virus Epstein-Barr', isCorrect: false },
      { text: 'Anafilaxia recurrente desencadenada por alimentos', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es el patrón de herencia más frecuente de la enfermedad granulomatosa crónica secundaria a variante del gen CYBB?',
    options: [
      { text: 'Autosómico dominante', isCorrect: false },
      { text: 'Autosómico recesivo', isCorrect: false },
      { text: 'Ligado al cromosoma X dominante', isCorrect: false },
      { text: 'Ligado al cromosoma X recesivo', isCorrect: true },
    ],
  },
  {
    text: 'En relación a las manifestaciones no infecciosas en Errores Innatos de la Inmunidad, ¿en qué porcentaje esta forma de presentación puede ser la primera manifestación de un error innato de la inmunidad?',
    options: [
      { text: '10%', isCorrect: false },
      { text: '15%', isCorrect: false },
      { text: '25%', isCorrect: true },
      { text: '30%', isCorrect: false },
      { text: '35%', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es actualmente el principal objetivo de la profilaxis a largo plazo en el angioedema hereditario?',
    options: [
      { text: 'Normalizar los niveles séricos de C4', isCorrect: false },
      { text: 'Evitar exclusivamente los episodios de edema laríngeo', isCorrect: false },
      { text: 'Reducir la frecuencia y gravedad de los ataques y mejorar la calidad de vida', isCorrect: true },
      { text: 'Sustituir la necesidad de tratamiento durante los ataques agudos', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es el examen de primera línea más útil para orientar el estudio de un paciente con sospecha de Error Innato de la Inmunidad?',
    options: [
      { text: 'Secuenciación de exoma completo', isCorrect: false },
      { text: 'Citometría de flujo de subpoblaciones linfocitarias', isCorrect: false },
      { text: 'Hemograma con diferencial e inmunoglobulinas séricas', isCorrect: true },
      { text: 'Panel genético para IEI', isCorrect: false },
    ],
  },
  {
    text: 'Un niño de 8 años es derivado por historia de eczema de inicio neonatal, abscesos cutáneos "fríos" recurrentes por Staphylococcus aureus (con escasa signología inflamatoria), neumonías a repetición con formación de neumatoceles, candidiasis mucocutánea, retención de dientes primarios, fracturas ante traumatismos menores y facies característica (frente prominente, puente nasal ancho, asimetría facial). La IgE sérica es de 8.500 IU/mL con eosinofilia moderada. ¿Cuál es el mecanismo molecular subyacente más probable?',
    options: [
      { text: 'Mutación de pérdida de función en DOCK8 con susceptibilidad a infecciones virales cutáneas graves', isCorrect: false },
      { text: 'Mutación dominante-negativa en STAT3 con deterioro de la diferenciación de linfocitos Th17 y reducción de IL-17/IL-22', isCorrect: true },
      { text: 'Mutación en AIRE con falla de la tolerancia central y poliendocrinopatía autoinmune', isCorrect: false },
      { text: 'Mutación en BTK con bloqueo del desarrollo de linfocitos B y agammaglobulinemia', isCorrect: false },
      { text: 'Mutación en WAS (proteína WASP) con trombocitopenia microplaquetaria y eczema', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de las siguientes afirmaciones sobre las bases genéticas y características clínicas del síndrome de DiGeorge es correcta?',
    options: [
      { text: 'Se produce principalmente por una mutación puntual en el gen TBX1 y cursa con hipercalcemia severa', isCorrect: false },
      { text: 'Está causado por una microdeleción en la región 22q11.2, y sus manifestaciones clínicas incluyen defectos cardíacos congénitos, anomalías palatinas e inmunodeficiencia por hipoplasia tímica', isCorrect: true },
      { text: 'Es un trastorno ligado al cromosoma X que afecta exclusivamente a varones y provoca macrocefalia', isCorrect: false },
      { text: 'Se genera por una duplicación cromosómica y se caracteriza por un desarrollo excesivo de las glándulas paratiroides', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de las siguientes manifestaciones cutáneas debería alertar más sobre un posible error innato de la inmunidad?',
    options: [
      { text: 'Acné inflamatorio adolescente', isCorrect: false },
      { text: 'Melasma facial', isCorrect: false },
      { text: 'Dermatitis atópica leve', isCorrect: false },
      { text: 'Verrugas extensas, numerosas y persistentes', isCorrect: true },
      { text: 'Queratosis pilaris', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de las siguientes afirmaciones no forma parte de las recomendaciones actuales de inmunización en pacientes con errores innatos de la inmunidad?',
    options: [
      { text: 'En pacientes con deficiencias predominante de Anticuerpos, sin terapia de reemplazo de Inmunoglobulinas, como el déficit de Anticuerpos Antineumococo o déficit de subclases de IgG, no se recomienda realizar controles serológicos para evaluar la respuesta post vacunal, sin necesidad de documentar títulos protectores para valorar refuerzos', isCorrect: true },
      { text: 'En Inmunodeficiencias combinadas severas o combinadas con características sindromáticas, están contraindicadas de forma absoluta las vacunas vivas atenuadas', isCorrect: false },
      { text: 'Pacientes con deficiencias de los componentes del complemento, pueden recibir todas las vacunas incluidas en el programa nacional de Inmunización, tanto inactivadas como vivas atenuadas', isCorrect: false },
      { text: 'Es necesario actualizar la vacunación de los niños y adultos que viven con pacientes con errores innatos de la inmunidad, en especial quienes tienen familiares con defectos de la inmunidad celular', isCorrect: false },
    ],
  },
  {
    text: 'Según los criterios de la Fundación Jeffrey Modell (JMF), ¿cuál de los siguientes hallazgos se considera una "señal de alerta" para sospechar de un error innato de la inmunidad (inmunodeficiencia primaria) en un niño?',
    options: [
      { text: 'Escolar con antecedentes de asma con 8 episodios de rinofaringitis aguda en el último año', isCorrect: false },
      { text: 'Preescolar con antecedentes de rinitis alérgica, con un episodio de neumonía adquirida en la comunidad que responde a antibióticos orales', isCorrect: false },
      { text: 'Adolescente con historia de 2 episodios de sinusitis grave en el último año con necesidad de tratamiento endovenoso en la segunda infección', isCorrect: true },
      { text: 'Lactante sano hospitalizado durante 5 días, por infección respiratoria debido a virus de Influenza con requerimiento bajo de oxígeno por naricera, sin necesidad de antibióticos', isCorrect: false },
    ],
  },
];

const EXAM_TITLE = 'III Jornadas Regionales SCAI';

try {
  const existingExams = await prisma.exam.findMany({
    where: {
      OR: [
        { title: EXAM_TITLE },
        { title: 'Test de Inmunología Clínica' },
      ],
    },
  });

  for (const existing of existingExams) {
    await prisma.certificate.deleteMany({ where: { examId: existing.id } });
    await prisma.examAttempt.deleteMany({ where: { examId: existing.id } });
    await prisma.exam.delete({ where: { id: existing.id } });
  }

  if (existingExams.length) console.log('Exámenes anteriores eliminados.');

  const course = await prisma.course.findFirst({ where: { published: true } });

  const exam = await prisma.exam.create({
    data: {
      title: EXAM_TITLE,
      courseId: course?.id,
      passingScore: 67,
      published: true,
      questions: {
        create: questions.map((q, i) => ({
          text: q.text,
          order: i + 1,
          options: { create: q.options },
        })),
      },
    },
    include: { questions: true },
  });

  console.log('Examen creado:', exam.id);
  console.log('Preguntas:', exam.questions.length);
  console.log('Nota máxima: 7.0');
  console.log('Nota de aprobación: 5.0 (10/15 correctas)');
} finally {
  await prisma.$disconnect();
}

import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const questions = [
  {
    text: '¿Cuál es la función principal del sistema inmune adaptativo?',
    options: [
      { text: 'Reconocer y recordar antígenos específicos', isCorrect: true },
      { text: 'Actuar de forma inmediata e inespecífica', isCorrect: false },
      { text: 'Producir glóbulos rojos', isCorrect: false },
      { text: 'Sintetizar hormonas', isCorrect: false },
    ],
  },
  {
    text: '¿Qué tipo de célula es responsable de la inmunidad humoral?',
    options: [
      { text: 'Linfocitos B', isCorrect: true },
      { text: 'Linfocitos T citotóxicos', isCorrect: false },
      { text: 'Macrófagos', isCorrect: false },
      { text: 'Células NK', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de las siguientes inmunoglobulinas es la más abundante en suero?',
    options: [
      { text: 'IgG', isCorrect: true },
      { text: 'IgA', isCorrect: false },
      { text: 'IgM', isCorrect: false },
      { text: 'IgE', isCorrect: false },
    ],
  },
  {
    text: '¿Qué inmunoglobulina se asocia principalmente con reacciones alérgicas?',
    options: [
      { text: 'IgE', isCorrect: true },
      { text: 'IgG', isCorrect: false },
      { text: 'IgD', isCorrect: false },
      { text: 'IgM', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es el primer anticuerpo producido en una respuesta inmune primaria?',
    options: [
      { text: 'IgM', isCorrect: true },
      { text: 'IgG', isCorrect: false },
      { text: 'IgA', isCorrect: false },
      { text: 'IgE', isCorrect: false },
    ],
  },
  {
    text: '¿Qué célula presenta antígenos a los linfocitos T mediante el complejo MHC-II?',
    options: [
      { text: 'Célula dendrítica', isCorrect: true },
      { text: 'Linfocito B virginal', isCorrect: false },
      { text: 'Eritrocito', isCorrect: false },
      { text: 'Plaqueta', isCorrect: false },
    ],
  },
  {
    text: '¿Qué molécula reconoce el linfocito T citotóxico (CD8+)?',
    options: [
      { text: 'Antígenos presentados por MHC-I', isCorrect: true },
      { text: 'Antígenos presentados por MHC-II', isCorrect: false },
      { text: 'Anticuerpos libres', isCorrect: false },
      { text: 'Complemento activado', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de los siguientes es un error innato de la inmunidad?',
    options: [
      { text: 'Agammaglobulinemia de Bruton', isCorrect: true },
      { text: 'Lupus eritematoso sistémico', isCorrect: false },
      { text: 'Artritis reumatoide', isCorrect: false },
      { text: 'Asma alérgica', isCorrect: false },
    ],
  },
  {
    text: '¿Qué vía del complemento se activa primero en una respuesta innata frente a bacterias?',
    options: [
      { text: 'Vía alternativa', isCorrect: true },
      { text: 'Vía clásica', isCorrect: false },
      { text: 'Vía de las lectinas', isCorrect: false },
      { text: 'Vía del complemento terminal', isCorrect: false },
    ],
  },
  {
    text: '¿Qué citoquina es fundamental para la diferenciación de linfocitos T helper (Th1)?',
    options: [
      { text: 'IL-12', isCorrect: true },
      { text: 'IL-4', isCorrect: false },
      { text: 'IL-10', isCorrect: false },
      { text: 'TGF-β', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es la característica principal de la hipersensibilidad tipo I?',
    options: [
      { text: 'Mediada por IgE y mastocitos', isCorrect: true },
      { text: 'Mediada por complejos inmunes', isCorrect: false },
      { text: 'Mediada por linfocitos T', isCorrect: false },
      { text: 'Mediada por IgG citotóxica', isCorrect: false },
    ],
  },
  {
    text: '¿Qué laboratorio es útil como cribado en la inmunodeficiencia humoral?',
    options: [
      { text: 'Cuantificación de inmunoglobulinas séricas', isCorrect: true },
      { text: 'Recuento de eosinófilos', isCorrect: false },
      { text: 'VSG', isCorrect: false },
      { text: 'Hemoglobina glicosilada', isCorrect: false },
    ],
  },
  {
    text: '¿Qué enfermedad autoinmune afecta principalmente la unión neuromuscular?',
    options: [
      { text: 'Miastenia gravis', isCorrect: true },
      { text: 'Esclerosis múltiple', isCorrect: false },
      { text: 'Síndrome de Sjögren', isCorrect: false },
      { text: 'Psoriasis', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de los siguientes anticuerpos es marcador del lupus eritematoso sistémico?',
    options: [
      { text: 'Anti-ADN de doble cadena (anti-dsDNA)', isCorrect: true },
      { text: 'Anti-CCP', isCorrect: false },
      { text: 'Anti-Jo-1', isCorrect: false },
      { text: 'Anti-Scl-70', isCorrect: false },
    ],
  },
  {
    text: '¿Qué receptor reconoce patrones moleculares asociados a patógenos (PAMPs)?',
    options: [
      { text: 'Toll-like receptors (TLR)', isCorrect: true },
      { text: 'Receptor de células T (TCR)', isCorrect: false },
      { text: 'Receptor de células B (BCR)', isCorrect: false },
      { text: 'Receptor Fc', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es el mecanismo de acción principal de los anticuerpos monoclonales anti-TNF?',
    options: [
      { text: 'Neutralizar el TNF-α reduciendo inflamación', isCorrect: true },
      { text: 'Activar los linfocitos T reguladores', isCorrect: false },
      { text: 'Inhibir la replicación viral', isCorrect: false },
      { text: 'Estimular la producción de IgA', isCorrect: false },
    ],
  },
  {
    text: '¿Qué órgano es el principal sitio de maduración de los linfocitos T?',
    options: [
      { text: 'Timo', isCorrect: true },
      { text: 'Bazo', isCorrect: false },
      { text: 'Médula ósea', isCorrect: false },
      { text: 'Ganglio linfático', isCorrect: false },
    ],
  },
  {
    text: '¿Qué inmunoglobulina predomina en secreciones mucosas como saliva y leche materna?',
    options: [
      { text: 'IgA secretora', isCorrect: true },
      { text: 'IgG', isCorrect: false },
      { text: 'IgM', isCorrect: false },
      { text: 'IgD', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es la principal función de las células T reguladoras (Treg)?',
    options: [
      { text: 'Suprimir respuestas inmunes excesivas y mantener tolerancia', isCorrect: true },
      { text: 'Activar linfocitos B para producir anticuerpos', isCorrect: false },
      { text: 'Destruir células tumorales', isCorrect: false },
      { text: 'Secretar IgE frente a parásitos', isCorrect: false },
    ],
  },
  {
    text: '¿Qué prueba confirma el diagnóstico de inmunodeficiencia variable común (IDVC)?',
    options: [
      { text: 'IgG sérica < 500 mg/dL con ausencia de respuesta a vacunas', isCorrect: true },
      { text: 'Ausencia de linfocitos T en sangre periférica', isCorrect: false },
      { text: 'Niveles elevados de IgE total', isCorrect: false },
      { text: 'Complemento C3 disminuido', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es la causa más común de inmunodeficiencia secundaria a nivel mundial?',
    options: [
      { text: 'Infección por VIH', isCorrect: true },
      { text: 'Desnutrición proteica', isCorrect: false },
      { text: 'Uso de corticoides', isCorrect: false },
      { text: 'Quimioterapia', isCorrect: false },
    ],
  },
  {
    text: '¿Qué célula efectora libera histamina en reacciones alérgicas inmediatas?',
    options: [
      { text: 'Mastocito', isCorrect: true },
      { text: 'Linfocito T', isCorrect: false },
      { text: 'Célula dendrítica', isCorrect: false },
      { text: 'Monocito', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es el mecanismo principal de hipersensibilidad tipo IV (retardada)?',
    options: [
      { text: 'Mediada por linfocitos T sensibilizados', isCorrect: true },
      { text: 'Mediada por IgE', isCorrect: false },
      { text: 'Mediada por depósito de complejos antígeno-anticuerpo', isCorrect: false },
      { text: 'Mediada por IgG citotóxica', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál de los siguientes marcadores se asocia con linfocitos T helper?',
    options: [
      { text: 'CD4', isCorrect: true },
      { text: 'CD8', isCorrect: false },
      { text: 'CD19', isCorrect: false },
      { text: 'CD56', isCorrect: false },
    ],
  },
  {
    text: '¿Qué proceso permite a los linfocitos B producir anticuerpos de mayor afinidad con el tiempo?',
    options: [
      { text: 'Hipermutación somática y selección en centros germinales', isCorrect: true },
      { text: 'Recombinación V(D)J', isCorrect: false },
      { text: 'Activación del complemento', isCorrect: false },
      { text: 'Presentación antigénica por MHC-I', isCorrect: false },
    ],
  },
  {
    text: '¿Qué interleucina promueve principalmente la diferenciación de linfocitos Th2?',
    options: [
      { text: 'IL-4', isCorrect: true },
      { text: 'IL-12', isCorrect: false },
      { text: 'IFN-γ', isCorrect: false },
      { text: 'IL-17', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es la principal célula efectora en la inmunidad antitumoral adaptativa?',
    options: [
      { text: 'Linfocito T CD8+ citotóxico', isCorrect: true },
      { text: 'Linfocito B', isCorrect: false },
      { text: 'Basófilo', isCorrect: false },
      { text: 'Célula plasmática', isCorrect: false },
    ],
  },
  {
    text: '¿Qué anticuerpo cruza la barrera placentaria otorgando inmunidad pasiva al feto?',
    options: [
      { text: 'IgG', isCorrect: true },
      { text: 'IgA', isCorrect: false },
      { text: 'IgM', isCorrect: false },
      { text: 'IgE', isCorrect: false },
    ],
  },
  {
    text: '¿Qué componente del sistema del complemento actúa como potente anafilotoxina?',
    options: [
      { text: 'C5a', isCorrect: true },
      { text: 'C1q', isCorrect: false },
      { text: 'C4b', isCorrect: false },
      { text: 'C3b', isCorrect: false },
    ],
  },
  {
    text: '¿Cuál es la definición correcta de tolerancia central?',
    options: [
      { text: 'Eliminación de linfocitos autorreactivos en órganos linfoides primarios', isCorrect: true },
      { text: 'Activación de linfocitos por antígenos propios en tejidos periféricos', isCorrect: false },
      { text: 'Producción de IgG frente a antígenos propios', isCorrect: false },
      { text: 'Inactivación de células NK en bazo', isCorrect: false },
    ],
  },
];

try {
  const existing = await prisma.exam.findFirst({ where: { title: 'Test de Inmunología Clínica' } });
  if (existing) {
    await prisma.certificate.deleteMany({ where: { examId: existing.id } });
    await prisma.examAttempt.deleteMany({ where: { examId: existing.id } });
    await prisma.exam.delete({ where: { id: existing.id } });
    console.log('Examen anterior eliminado.');
  }

  const course = await prisma.course.findFirst({ where: { published: true } });

  const exam = await prisma.exam.create({
    data: {
      title: 'Test de Inmunología Clínica',
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
  console.log('Nota de aprobación: 5.0');
} finally {
  await prisma.$disconnect();
}

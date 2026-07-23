import {
  getBatches,
  getStudents,
  getStudent,
  getBatch,
  getStudentAttendanceStats,
  getStudentTestStats,
  getTests,
  getAttendanceHistory,
  getState,
} from './store.js';

function analyzeAttendance() {
  const students = getStudents();
  const insights = [];

  for (const student of students) {
    const stats = getStudentAttendanceStats(student.id);
    if (stats.total < 2) continue;

    if (stats.rate < 70) {
      insights.push({
        type: 'warning',
        text: `${student.name} has ${stats.rate}% attendance (${stats.absent} absences). Consider reaching out to ${student.parentName}.`,
        studentId: student.id,
      });
    }

    const recent = stats.records.slice(0, 5);
    const recentAbsent = recent.filter((r) => r.status === 'absent').length;
    if (recentAbsent >= 3) {
      insights.push({
        type: 'alert',
        text: `${student.name} was absent ${recentAbsent} of last ${recent.length} sessions — a concerning pattern.`,
        studentId: student.id,
      });
    }
  }

  return insights;
}

function analyzePerformance() {
  const students = getStudents();
  const insights = [];

  for (const student of students) {
    const stats = getStudentTestStats(student.id);
    if (stats.results.length === 0) continue;

    if (stats.avg < 50) {
      insights.push({
        type: 'warning',
        text: `${student.name}'s average test score is ${stats.avg}%. Personalized support may help.`,
        studentId: student.id,
      });
    }

    if (stats.results.length >= 2) {
      const sorted = [...stats.results].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].pct;
      const last = sorted[sorted.length - 1].pct;
      const diff = last - first;
      if (diff >= 15) {
        insights.push({
          type: 'success',
          text: `${student.name} improved ${diff}% from first to latest test — great progress!`,
          studentId: student.id,
        });
      } else if (diff <= -15) {
        insights.push({
          type: 'warning',
          text: `${student.name}'s scores dropped ${Math.abs(diff)}% recently. Review recent topics.`,
          studentId: student.id,
        });
      }
    }
  }

  return insights;
}

function analyzeBatches() {
  const batches = getBatches();
  const insights = [];

  for (const batch of batches) {
    const count = getStudents(batch.id).length;
    if (count >= batch.capacity) {
      insights.push({
        type: 'info',
        text: `${batch.name} is at full capacity (${count}/${batch.capacity}). Consider opening a new batch.`,
      });
    }
    if (count === 0) {
      insights.push({
        type: 'info',
        text: `${batch.name} has no students enrolled yet.`,
      });
    }
  }

  return insights;
}

export function generateInsights() {
  return [...analyzeAttendance(), ...analyzePerformance(), ...analyzeBatches()];
}

function findStudentByName(query) {
  const q = query.toLowerCase();
  return getStudents().find(
    (s) => s.name.toLowerCase().includes(q) || s.parentName.toLowerCase().includes(q)
  );
}

function summarizeStudent(student) {
  const batch = getBatch(student.batchId);
  const att = getStudentAttendanceStats(student.id);
  const tests = getStudentTestStats(student.id);

  return `**${student.name}** (Grade ${student.grade})
Batch: ${batch?.name || 'Unassigned'}
Parent: ${student.parentName} · ${student.parentPhone}
Attendance: ${att.rate}% (${att.present} present, ${att.absent} absent, ${att.late} late)
Test average: ${tests.avg}% across ${tests.results.length} test(s)
${tests.results.length ? 'Recent: ' + tests.results.slice(-2).map((r) => `${r.test}: ${r.pct}%`).join(', ') : ''}`;
}

function draftParentMessage(student, topic) {
  const settings = getState().settings;
  if (topic === 'low attendance') {
    const att = getStudentAttendanceStats(student.id);
    return `Dear ${student.parentName},

We noticed ${student.name}'s attendance is currently at ${att.rate}%. Regular attendance is important for consistent progress.

Could we schedule a quick call to discuss how we can support ${student.name}?

Best regards,
${settings.tutorName}`;
  }

  if (topic === 'test results') {
    const tests = getStudentTestStats(student.id);
    const latest = tests.results[tests.results.length - 1];
    if (!latest) return `No test records found for ${student.name}.`;
    return `Dear ${student.parentName},

Sharing an update on ${student.name}'s recent performance in ${latest.subject}.

Latest test (${latest.test}): ${latest.score}/${latest.max} (${latest.pct}%)
Overall average: ${tests.avg}%

Happy to discuss a study plan if helpful.

Best regards,
${settings.tutorName}`;
  }

  return `Dear ${student.parentName},

This is a check-in regarding ${student.name}'s progress at ${settings.tutorName}. Please let us know a convenient time to connect.

Best regards,
${settings.tutorName}`;
}

export async function chatWithAI(userMessage, role = 'owner') {
  const settings = getState().settings;
  const lower = userMessage.toLowerCase();

  if (settings.openaiApiKey) {
    try {
      const context = buildContextSummary(role);
      const systemPrompt = getRoleSystemPrompt(role);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nCurrent data summary:\n${context}` },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 600,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'No response generated.';
        const { saveAIConversation } = await import('./platform.js');
        saveAIConversation(role, userMessage, reply);
        return reply;
      }
    } catch {
      // fall through to local AI
    }
  }

  const reply = await localAIResponse(userMessage, lower, role);
  const { saveAIConversation } = await import('./platform.js');
  saveAIConversation(role, userMessage, reply);
  return reply;
}

function getRoleSystemPrompt(role) {
  const prompts = {
    owner: 'You are an AI Academy Manager for EduOS. Help owners with operations, decisions, capacity, leads, and business health. Be concise and actionable.',
    tutor: 'You are an AI Lesson Assistant for EduOS tutors. Help generate lesson plans, quizzes, homework, and teaching strategies.',
    parent: 'You are an AI Parent Assistant for EduOS. Help parents understand their child\'s progress and how to support learning at home.',
    student: 'You are an AI Tutor for students on EduOS. Explain concepts clearly with examples. Be encouraging and age-appropriate.',
  };
  return prompts[role] || prompts.owner;
}

function buildContextSummary(role) {
  const batches = getBatches();
  const students = getStudents();
  const tests = getTests();
  const insights = generateInsights().slice(0, 5);

  let extra = '';
  if (role === 'parent' && students[0]) {
    extra = `\nSample student: ${summarizeStudent(students[0])}`;
  }
  if (role === 'tutor') {
    extra = `\nBatches: ${batches.map((b) => b.name).join(', ')}`;
  }

  return `Tutor: ${getState().settings.tutorName}
Batches: ${batches.length}
Students: ${students.length}
Tests recorded: ${tests.length}
Key insights: ${insights.map((i) => i.text).join('; ') || 'None yet'}${extra}`;
}

async function localAIResponse(message, lower, role = 'owner') {
  if (role === 'student') return studentAIResponse(message, lower);
  if (role === 'parent') return parentAIResponse(message, lower);
  if (role === 'tutor') return tutorAIResponse(message, lower);

  if (lower.includes('insight') || lower.includes('analyze') || lower.includes('report')) {
    const insights = generateInsights();
    if (!insights.length) {
      return 'Everything looks stable! Add more attendance and test data for deeper insights.';
    }
    return 'Here are your AI-generated insights:\n\n' + insights.map((i, idx) => `${idx + 1}. ${i.text}`).join('\n');
  }

  if (lower.includes('attendance')) {
    const students = getStudents();
    const summary = students.map((s) => {
      const att = getStudentAttendanceStats(s.id);
      return `• ${s.name}: ${att.rate}% (${att.present}/${att.total} sessions)`;
    }).join('\n');
    return `Attendance overview:\n\n${summary || 'No attendance records yet.'}`;
  }

  if (lower.includes('performance') || lower.includes('test') || lower.includes('marks')) {
    const students = getStudents();
    const summary = students.map((s) => {
      const t = getStudentTestStats(s.id);
      return `• ${s.name}: avg ${t.avg}% (${t.results.length} tests)`;
    }).join('\n');
    return `Test performance overview:\n\n${summary || 'No test records yet.'}`;
  }

  const student = findStudentByName(message);
  if (student) {
    if (lower.includes('message') || lower.includes('whatsapp') || lower.includes('draft')) {
      const topic = lower.includes('attendance') ? 'low attendance' : lower.includes('test') ? 'test results' : 'general';
      return `Draft parent message for ${student.name}:\n\n${draftParentMessage(student, topic)}`;
    }
    return summarizeStudent(student);
  }

  if (lower.includes('draft') && lower.includes('message')) {
    return 'Tell me a student name and topic, e.g. "Draft message for Aarav about attendance"';
  }

  if (lower.includes('lesson') || lower.includes('quiz') || lower.includes('homework')) {
    return `Here's a draft lesson plan:\n\nObjectives: Understand core concepts\nActivities: Warm-up, explanation, group practice, Q&A\nHomework: Practice exercises\nQuiz: 5 questions covering the topic\n\nCustomize in Tutor Success → Lesson Plans.`;
  }

  if (lower.includes('newton') || lower.includes('explain')) {
    return `Newton's Laws of Motion:\n\n1. First Law (Inertia): An object stays at rest or in motion unless acted upon by a force.\n\n2. Second Law: F = ma — force equals mass times acceleration.\n\n3. Third Law: Every action has an equal and opposite reaction.\n\nExample: When you push a wall, the wall pushes back with equal force.`;
  }

  if (lower.includes('today') && lower.includes('problem')) {
    const { generateOwnerDecisions } = await import('./intelligence.js');
    const decisions = generateOwnerDecisions();
    return 'Today\'s problems:\n\n' + decisions.slice(0, 5).map((d, i) => `${i + 1}. ${d.title}: ${d.detail}`).join('\n');
  }

  if (lower.includes('help') || lower.includes('what can you')) {
    return `I can help you with:

• **Insights** — "Show me insights" or "Analyze my data"
• **Attendance** — "How is attendance looking?"
• **Performance** — "Show test performance"
• **Student info** — "Tell me about Priya Patel"
• **Parent messages** — "Draft WhatsApp message for Aarav about attendance"

Add an OpenAI API key in Settings for smarter, conversational responses.`;
  }

  return `I can analyze attendance patterns, test performance, and draft parent WhatsApp messages. Try:

• "Show insights"
• "How is attendance?"
• "Tell me about Aarav Sharma"
• "Draft message for Priya about test results"

For advanced AI, add your OpenAI API key in Settings.`;
}

function tutorAIResponse(message, lower) {
  if (lower.includes('lesson') || lower.includes('plan')) {
    const topic = message.replace(/generate|lesson|plan|for|tomorrow|create/gi, '').trim() || 'tomorrow\'s topic';
    return `Draft lesson plan for "${topic}":\n\nObjectives: Students will understand key concepts\nActivities: Warm-up recap, interactive explanation, group practice, Q&A\nHomework: Practice exercises\nQuiz: 5 MCQ + 2 short answer\n\nSave this in Tutor Success → Lesson Plans, or use AI generate there.`;
  }
  if (lower.includes('quiz') || lower.includes('question')) {
    return `Sample quiz (5 questions):\n\n1. Define the core concept\n2. Solve a basic problem\n3. Apply to real-world scenario\n4. Compare two approaches\n5. Explain your reasoning\n\nAdjust difficulty in Tutor Success → Lesson Plans.`;
  }
  if (lower.includes('homework')) {
    return `Homework ideas:\n• Worksheet pages from textbook\n• 10 practice problems (mixed difficulty)\n• One real-world application question\n• Peer review activity\n\nAssign via Tutor Success → Homework tab.`;
  }
  return `I'm your AI Lesson Assistant. Ask me to:\n• Generate a lesson plan\n• Create a quiz\n• Suggest homework activities\n• Explain teaching strategies for a topic`;
}

function parentAIResponse(message, lower) {
  const student = findStudentByName(message) || getStudents()[0];
  if (!student) return 'No student data available yet.';

  if (lower.includes('score') || lower.includes('lower') || lower.includes('why')) {
    const tests = getStudentTestStats(student.id);
    const att = getStudentAttendanceStats(student.id);
    return `${student.name}'s recent performance:\n\nAttendance: ${att.rate}%\nTest average: ${tests.avg || 'N/A'}%\n${tests.results.length ? 'Latest: ' + tests.results.slice(-1)[0].test + ' — ' + tests.results.slice(-1)[0].pct + '%' : ''}\n\nPossible reasons for lower scores: missed classes, topic gaps, or test anxiety. I recommend reviewing homework completion and scheduling a check-in with the teacher.`;
  }
  if (lower.includes('help') || lower.includes('support')) {
    return `Ways to support ${student.name} at home:\n\n1. Set a fixed study schedule (30–45 min daily)\n2. Review teacher feedback in Parent Portal\n3. Ensure homework is submitted on time\n4. Ask your child to explain what they learned each class\n5. Contact the teacher via Parent Portal → Messages`;
  }
  if (lower.includes('attendance')) {
    const att = getStudentAttendanceStats(student.id);
    return `${student.name}'s attendance is ${att.rate}% (${att.present} present, ${att.absent} absent, ${att.late} late). ${att.rate < 75 ? 'Consider setting reminders before class times.' : 'Good consistency — keep it up!'}`;
  }
  if (student && (lower.includes('about') || student.name.toLowerCase().split(' ').some((p) => lower.includes(p)))) {
    return summarizeStudent(student);
  }
  return `I'm your AI Parent Assistant for ${student.name}. Ask me:\n• "Why did scores change?"\n• "How can I help at home?"\n• "Tell me about attendance"\n• "Tell me about ${student.name}"`;
}

function studentAIResponse(message, lower) {
  if (lower.includes('newton') || lower.includes('motion')) {
    return `Newton's Laws of Motion:\n\n1. First Law (Inertia): Objects stay at rest or in motion unless a force acts on them.\n2. Second Law: F = ma — force equals mass times acceleration.\n3. Third Law: Every action has an equal and opposite reaction.\n\nExample: When you push a wall, it pushes back with equal force.`;
  }
  if (lower.includes('quadratic') || lower.includes('algebra')) {
    return `Quadratic Equations:\n\nA quadratic has the form ax² + bx + c = 0.\n\nSolve by:\n1. Factoring — find two numbers that multiply to ac and add to b\n2. Quadratic formula: x = (-b ± √(b²-4ac)) / 2a\n3. Completing the square\n\nTry factoring x² - 5x + 6 = 0 → (x-2)(x-3) = 0 → x = 2 or x = 3`;
  }
  if (lower.includes('chemical') || lower.includes('bond')) {
    return `Chemical Bonding:\n\n• Ionic bonds — electrons transfer between atoms (e.g. NaCl)\n• Covalent bonds — atoms share electrons (e.g. H₂O)\n• Metallic bonds — electrons flow freely in metals\n\nRemember: atoms bond to achieve a stable electron configuration.`;
  }
  if (lower.includes('explain') || lower.includes('help')) {
    return `I'd love to help! Tell me the specific topic you're studying — for example:\n• "Explain Newton's Laws"\n• "Help with quadratic equations"\n• "What is chemical bonding?"`;
  }
  return `I'm your AI Tutor. Ask me to explain any topic you're learning in class. I can break down concepts step by step with examples.`;
}

export async function runAIAction(action, params = {}) {
  const { generateLessonPlanAI } = await import('./platform.js');
  const { generateOwnerDecisions, getDropoutRiskStudents } = await import('./intelligence.js');

  if (action === 'lesson_plan') {
    const topic = params.topic || 'General topic';
    const plan = generateLessonPlanAI(topic);
    return { type: 'lesson_plan', topic, ...plan };
  }
  if (action === 'parent_message') {
    const student = params.studentId ? getStudent(params.studentId) : findStudentByName(params.name || '') || getStudents()[0];
    if (!student) return { type: 'error', message: 'Student not found' };
    const topic = params.topic || 'general';
    return { type: 'parent_message', student: student.name, body: draftParentMessage(student, topic) };
  }
  if (action === 'quiz') {
    const topic = params.topic || 'the topic';
    return { type: 'quiz', topic, questions: [`Define key terms in ${topic}`, `Solve a basic ${topic} problem`, `Apply ${topic} to a real scenario`, `Compare two ${topic} methods`, `Explain ${topic} in your own words`] };
  }
  if (action === 'decisions') {
    return { type: 'decisions', items: generateOwnerDecisions().slice(0, 5) };
  }
  if (action === 'dropout_risk') {
    return { type: 'dropout_risk', students: getDropoutRiskStudents().filter((s) => s.risk !== 'low') };
  }
  if (action === 'study_plan') {
    const student = params.studentId ? getStudent(params.studentId) : getStudents()[0];
    if (!student) return { type: 'error', message: 'No student' };
    const tests = getStudentTestStats(student.id);
    const weak = tests.results.filter((r) => r.pct < 65).map((r) => r.subject).join(', ') || 'general revision';
    return { type: 'study_plan', student: student.name, plan: `Weekly plan for ${student.name}:\n• Mon/Wed: Review ${weak}\n• Tue/Thu: Practice problems (30 min)\n• Fri: Self-quiz on week's topics\n• Weekend: Rest + light reading` };
  }
  return { type: 'error', message: 'Unknown action' };
}

export function getAICapabilities(role) {
  const caps = {
    owner: [
      { id: 'decisions', label: 'Today\'s decisions', desc: 'Priority actions for the academy' },
      { id: 'dropout_risk', label: 'Dropout risk scan', desc: 'Students needing intervention' },
      { id: 'parent_message', label: 'Draft parent message', desc: 'WhatsApp-ready parent update' },
    ],
    tutor: [
      { id: 'lesson_plan', label: 'Generate lesson plan', desc: 'Objectives, activities, homework, quiz' },
      { id: 'quiz', label: 'Create quiz', desc: '5 questions for any topic' },
    ],
    parent: [
      { id: 'study_plan', label: 'Home study plan', desc: 'Weekly support schedule' },
      { id: 'parent_message', label: 'Draft teacher message', desc: 'Message template for teacher' },
    ],
    student: [
      { id: 'study_plan', label: 'Study plan', desc: 'Personalized revision schedule' },
    ],
  };
  return caps[role] || caps.owner;
}

export { draftParentMessage, summarizeStudent };

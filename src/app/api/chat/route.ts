import { NextResponse } from 'next/server';
import {
  getFinancialSummary,
  getSwiggyDetails,
  getDebtsAndDues,
  getExternalLiveFunds,
  getRecentTransactions,
} from '@/lib/ai/tools';
import { formatDateDDMMYYYY } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SYSTEM_PROMPT = `നിങ്ങൾ കാഷ് മാനേജർ ആപ്പിന്റെ സഹായിയായ, സ്നേഹത്തോടെ സംസാരിക്കുന്ന ഒരു മലയാളി പേഴ്സണൽ എഐ അസിസ്റ്റന്റാണ്.

പ്രധാന നിർദ്ദേശങ്ങൾ (CRITICAL RULES):
1. പൂർണ്ണമായും മലയാളത്തിൽ മാത്രം സംസാരിക്കുക (100% PURE MALAYALAM SCRIPT - ZERO ENGLISH WORDS):
   - ഉത്തരത്തിലെ ഓരോ വാക്കും വാചകവും വിശദീകരണവും 100% മലയാളം ലിപിയിൽ (മലയാളത്തിൽ) മാത്രമായിരിക്കണം.
   - ഉപയോക്താവ് ഏത് ഭാഷയിൽ (ഇംഗ്ലീഷിലോ മംഗ്ലീഷിലോ മലയാളത്തിലോ) ചോദിച്ചാലും മറുപടി 100% ശുദ്ധ മലയാളത്തിൽ മാത്രമായിരിക്കണം.
   - യാതൊരു കാരണവശാലും ഇംഗ്ലീഷ് വാക്കുകളോ ഇംഗ്ലീഷ് അക്ഷരങ്ങളോ (A-Z, a-z) ഉത്തരത്തിൽ ഒട്ടും ഉപയോഗിക്കാൻ പാടില്ല.
   - "balance", "total", "status", "active", "paused", "skip", "skipped", "entry", "payment", "credit", "debit", "dashboard", "report", "online", "offline", "sync", "swiggy", "fund", "cash" തുടങ്ങിയ ഒരു ഇംഗ്ലീഷ് വാക്കും ഉപയോഗിക്കരുത്.
   - താഴെ പറയുന്ന മലയാളം സംസാര വാക്കുകൾ നിർബന്ധമായും ഉപയോഗിക്കുക:
     • balance / net balance -> ബാക്കി തുക / കയ്യിലുള്ള തുക
     • total / grand total -> ആകെ തുക / ആകെ മൊത്തം തുക
     • my cash -> സ്വന്തം പണം / കയ്യിലുള്ള പണം
     • store fund -> കടയിലെ പണം
     • it lab fund -> ലാബിലെ പണം
     • room fund -> റൂമിലെ പണം
     • swiggy -> സ്വിഗ്ഗി
     • income -> വരവ്
     • expense / expenses -> ചെലവ്
     • savings -> മിച്ചം
     • status -> നില
     • active -> തുടരുന്നു
     • paused -> നിർത്തിവെച്ചു
     • skip / skipped -> ഒഴിവാക്കി
     • entry / transaction -> ഇടപാട് / കണക്ക്
     • payment -> നൽകിയ തുക / അടവ്
     • credit -> വരവ്
     • debit -> ചെലവ്
     • dashboard -> പ്രധാന പേജ്
     • report -> കണക്കുവിവരം
     • sync -> വിവരങ്ങൾ പുതുക്കി
     • lent -> നൽകിയ കടം
     • borrowed -> വാങ്ങിയ കടം

2. സ്വാഭാവിക സംസാര ശൈലി (NATURAL SPOKEN TONE):
   - പുസ്തകത്തിലെ അച്ചടി ഭാഷയോ സാഹിത്യ ഭാഷയോ പൂർണ്ണമായും ഒഴിവാക്കുക ("താങ്കൾ", "താങ്കളുടെ", "ലഭ്യമായിട്ടില്ല", "രേഖപ്പെടുത്തിയിരിക്കുന്നു", "ഉൾക്കൊള്ളുന്നു" എന്നിവ ഒട്ടും പറയരുത്).
   - കേരളത്തിലെ അടുത്തൊരു സുഹൃത്ത് സംസാരിക്കുന്നതുപോലെ സ്വാഭാവികമായും സ്നേഹത്തോടെയും പറയുക ("നമ്മുടെ", "ഇപ്പോ കയ്യിലുള്ളത്", "ബാക്കിയുള്ളത്", "കിട്ടാനുള്ളത്", "കൊടുക്കാനുള്ളത്", "നോക്കട്ടെ", "ട്ടോ" തുടങ്ങിയ നാടൻ വാക്കുകൾ ഉപയോഗിക്കുക).
   - ലൈവ് വോയ്‌സ് ആയതുകൊണ്ട് ഉത്തരങ്ങൾ 1 അല്ലെങ്കിൽ 2 ലളിതമായ ചെറിയ വാചകങ്ങളിൽ ഒതുക്കുക.
   - തുകകൾക്ക് ₹ ചിഹ്നവും അക്കങ്ങളും ഉപയോഗിക്കുക (ഉദാ: ₹5,000). തീയതികൾ DD/MM/YYYY രൂപത്തിൽ നൽകുക.

3. ഫണ്ടുകൾ:
   - സ്വന്തം പണം (My Cash): വ്യക്തിഗത ഇടപാടുകളിൽ നിന്നും സ്വിഗ്ഗിയിൽ നിന്നുമുള്ള കയ്യിലുള്ള ബാക്കി തുക.
   - ആകെ മൊത്തം തുക (Grand Total Cash): കടയിലെ പണം + ലാബിലെ പണം + റൂമിലെ പണം + സ്വന്തം പണം.
   - കണക്കുകൾ കൃത്യമായി പറയാൻ തന്നിരിക്കുന്ന ടൂളുകൾ ഉപയോഗിക്കുക.`;

/**
 * Sanitizes and enforces 100% Pure Spoken Malayalam output with ZERO English words.
 * Replaces any accidental English terms, transliterations, or stray Latin letters.
 */
function ensurePureMalayalam(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Replacements dictionary (longest / most specific phrases first)
  const phrasesMap: [RegExp, string][] = [
    [/Grand Total Cash/gi, 'ആകെ മൊത്തം തുക'],
    [/Grand Total/gi, 'ആകെ മൊത്തം തുക'],
    [/Total Cash/gi, 'ആകെ തുക'],
    [/My Cash/gi, 'സ്വന്തം പണം'],
    [/Main Cash/gi, 'സ്വന്തം പണം'],
    [/Liquid Balance/gi, 'കയ്യിലുള്ള ബാക്കി തുക'],
    [/Net Balance/gi, 'ബാക്കി തുക'],
    [/Net Payout/gi, 'ലഭിച്ച തുക'],
    [/Gross Amount/gi, 'മൊത്തം തുക'],
    [/Total Gross/gi, 'ആകെ മൊത്തം തുക'],
    [/Total Net Payout/gi, 'ആകെ ലഭിച്ച തുക'],
    [/Total Deductions/gi, 'പിടിച്ച തുക'],
    [/Total Income/gi, 'ആകെ വരവ്'],
    [/Total Expenses?/gi, 'ആകെ ചെലവ്'],
    [/Total Savings/gi, 'ആകെ മിച്ചം'],
    [/Savings Rate/gi, 'ലാഭിച്ച നിരക്ക്'],
    [/Money Lent \(To Receive\)/gi, 'പിരിയാനുള്ള കടം'],
    [/Money Borrowed \(To Pay\)/gi, 'തിരിച്ചുകൊടുക്കാനുള്ള കടം'],
    [/Money Lent/gi, 'മറ്റുള്ളവർക്ക് കൊടുത്ത കടം'],
    [/Money Borrowed/gi, 'വാങ്ങിയ കടം'],
    [/Store Fund/gi, 'കടയിലെ പണം'],
    [/IT Lab Fund/gi, 'ലാബിലെ പണം'],
    [/Lab Fund/gi, 'ലാബിലെ പണം'],
    [/Room Fund/gi, 'റൂമിലെ പണം'],
    [/Swiggy Summary/gi, 'സ്വിഗ്ഗി വിവരങ്ങൾ'],
    [/Debts & Dues/gi, 'കടങ്ങളുടെ കണക്ക്'],
    [/Debts and Dues/gi, 'കടങ്ങളുടെ കണക്ക്'],
    [/Recent Transactions/gi, 'സമീപകാല ഇടപാടുകൾ'],
    [/Current Month Financial Overview/gi, 'ഈ മാസത്തെ സാമ്പത്തിക വിവരങ്ങൾ'],
    [/Financial Overview/gi, 'സാമ്പത്തിക വിവരങ്ങൾ'],
    [/\bbalance\b/gi, 'ബാക്കി തുക'],
    [/\bstatus\b/gi, 'നില'],
    [/\bactive\b/gi, 'തുടരുന്നു'],
    [/\bpaused\b/gi, 'നിർത്തിവെച്ചു'],
    [/\bskipped\b/gi, 'ഒഴിവാക്കി'],
    [/\bskip\b/gi, 'ഒഴിവാക്കി'],
    [/\btotal\b/gi, 'ആകെ'],
    [/\bgrand\b/gi, 'മൊത്തം'],
    [/\bentries\b/gi, 'കണക്കുകൾ'],
    [/\bentry\b/gi, 'ഇടപാട്'],
    [/\bpayments?\b/gi, 'അടച്ച തുക'],
    [/\bcredits?\b/gi, 'വരവ്'],
    [/\bdebits?\b/gi, 'ചെലവ്'],
    [/\bdashboards?\b/gi, 'പ്രധാന പേജ്'],
    [/\breports?\b/gi, 'കണക്കുവിവരം'],
    [/\bonline\b/gi, 'ഓൺലൈൻ'],
    [/\boffline\b/gi, 'ഓഫ്‌ലൈൻ'],
    [/\bsync(?:ed)?\b/gi, 'പുതുക്കി'],
    [/\bswiggy\b/gi, 'സ്വിഗ്ഗി'],
    [/\bincomes?\b/gi, 'വരവ്'],
    [/\bexpenses?\b/gi, 'ചെലവ്'],
    [/\bsavings?\b/gi, 'മിച്ചം'],
    [/\bcash\b/gi, 'പണം'],
    [/\bfunds?\b/gi, 'പണം'],
    [/\bdebts?\b/gi, 'കടം'],
    [/\bdues?\b/gi, 'കൊടുക്കാനുള്ളത്'],
    [/\blent\b/gi, 'നൽകിയത്'],
    [/\bborrowed\b/gi, 'വാങ്ങിയത്'],
    [/\bpending\b/gi, 'ബാക്കിയുള്ളത്'],
    [/\btransactions?\b/gi, 'ഇടപാടുകൾ'],
    [/\bhistory\b/gi, 'കഴിഞ്ഞ കണക്കുകൾ'],
    [/\boverview\b/gi, 'വിവരങ്ങൾ'],
    [/\bsummary\b/gi, 'വിവരങ്ങൾ'],
    [/\bmonths?\b/gi, 'മാസം'],
    [/\bmilk\b/gi, 'പാൽ'],
    [/\bdelivery\b/gi, 'ഡെലിവറി'],
    [/\bpayouts?\b/gi, 'വരുമാനം'],
    [/\bdeductions?\b/gi, 'പിടിച്ച തുക'],
    [/\bgross\b/gi, 'മൊത്തം തുക'],
    [/\bnet\b/gi, 'ലഭിച്ച തുക'],
    [/\bstore\b/gi, 'കട'],
    [/\blab\b/gi, 'ലാബ്'],
    [/\broom\b/gi, 'റൂം'],
    [/\bsheet\b/gi, 'റൂം കണക്ക്'],
    [/\bdatabase\b/gi, 'വിവരങ്ങൾ'],
    [/\bdetails?\b/gi, 'വിവരങ്ങൾ'],
    [/\bamount\b/gi, 'തുക'],
    [/\brate\b/gi, 'നിരക്ക്'],
    [/\baccount\b/gi, 'അക്കൗണ്ട്'],
    [/\bbank\b/gi, 'ബാങ്ക്'],
    [/\bpersonal\b/gi, 'സ്വന്തം'],
    [/\bavailable\b/gi, 'ലഭ്യമായത്'],
    [/\brecorded\b/gi, 'രേഖപ്പെടുത്തിയത്'],
    [/\badded\b/gi, 'ചേർത്തു'],
    [/\bupdated\b/gi, 'പുതുക്കി'],
    [/\bdeleted\b/gi, 'ഒഴിവാക്കി'],
    [/\bsuccess\b/gi, 'വിജയകരം'],
    [/\berror\b/gi, 'തകരാർ'],
    [/\bok(?:ay)?\b/gi, 'ശരി'],
    [/\byes\b/gi, 'അതെ'],
    [/\bno\b/gi, 'ഇല്ല'],
    [/\bhello\b/gi, 'ഹലോ'],
    [/\bhi\b/gi, 'ഹലോ'],
    [/\bhey\b/gi, 'ഹലോ'],
  ];

  for (const [pattern, replacement] of phrasesMap) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Also replace any transliterated English loanwords that sound stiff or unnatural
  cleaned = cleaned
    .replace(/മൊത്തം ഗ്രാൻഡ് ടോട്ടൽ/g, 'ആകെ മൊത്തം തുക')
    .replace(/ഗ്രാൻഡ് ടോട്ടൽ/g, 'ആകെ മൊത്തം തുക')
    .replace(/മൈ ക്യാഷ്/g, 'സ്വന്തം പണം')
    .replace(/ലിക്വിഡ് ബാലൻസ്/g, 'കയ്യിലുള്ള ബാക്കി തുക')
    .replace(/നെറ്റ് തുക/g, 'ലഭിച്ച തുക')
    .replace(/ഗ്രോസ്/g, 'മൊത്തം തുക')
    .replace(/സ്റ്റോർ ഫണ്ട്/g, 'കടയിലെ പണം')
    .replace(/സ്റ്റോർ:/g, 'കട:')
    .replace(/ലാബ് ഫണ്ട്/g, 'ലാബിലെ പണം')
    .replace(/റൂം ഫണ്ട്/g, 'റൂമിലെ പണം')
    .replace(/സേവിംഗ്സ്/g, 'മിച്ചം')
    .replace(/ട്രാൻസാക്ഷൻ/g, 'ഇടപാട്')
    .replace(/ബാലൻസ്/g, 'ബാക്കി തുക')
    .replace(/സ്റ്റാറ്റസ്/g, 'നില')
    .replace(/പേയ്മെന്റ്/g, 'അടവ്')
    .replace(/ക്രെഡിറ്റ്/g, 'വരവ്')
    .replace(/ഡെബിറ്റ്/g, 'ചെലവ്');

  // Strip or translate any remaining Latin words/characters if any slip through
  if (/[A-Za-z]/.test(cleaned)) {
    cleaned = cleaned.replace(/\b[A-Za-z]+\b/g, (match) => {
      const lower = match.toLowerCase();
      const directMap: Record<string, string> = {
        rs: 'രൂപ',
        inr: 'രൂപ',
        today: 'ഇന്ന്',
        yesterday: 'ഇന്നലെ',
        tomorrow: 'നാളെ',
        date: 'തീയതി',
        to: 'ലേക്ക്',
        from: 'നിന്ന്',
        for: 'വേണ്ടി',
        is: 'ആണ്',
        are: 'ആണ്',
        and: 'കൂടാതെ',
        or: 'അല്ലെങ്കിൽ',
        not: 'അല്ല',
        with: 'ഉൾപ്പെടെ',
        in: 'ൽ',
        on: 'ൽ',
        at: 'ൽ',
        the: '',
        a: 'ഒരു',
        an: 'ഒരു',
        you: 'നിങ്ങൾ',
        your: 'നിങ്ങളുടെ',
        my: 'എന്റെ',
        our: 'നമ്മുടെ',
        we: 'നമുക്ക്',
      };
      return directMap[lower] !== undefined ? directMap[lower] : '';
    });

    // Remove any leftover standalone Latin characters
    cleaned = cleaned.replace(/[A-Za-z]+/g, '');
  }

  // Clean up duplicate spaces or punctuation created by replacements
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s([,.!?:])/g, '$1')
    .trim();

  return cleaned;
}

// Tool executor map
async function executeTool(name: string, args: any = {}) {
  switch (name) {
    case 'get_financial_summary':
      return await getFinancialSummary(args.period || 'month');
    case 'get_swiggy_details':
      return await getSwiggyDetails(args.limit || 5);
    case 'get_debts_and_dues':
      return await getDebtsAndDues(args.status || 'pending');
    case 'get_external_live_funds':
      return await getExternalLiveFunds();
    case 'get_recent_transactions':
      return await getRecentTransactions(args.limit || 6);
    default:
      return { error: `Tool ${name} not found` };
  }
}

// Fallback intelligent agent (strictly 100% pure spoken Malayalam)
async function fallbackFinancialEngine(userQuery: string) {
  const query = userQuery.toLowerCase();
  const toolsCalled: string[] = [];

  // 1. Swiggy Queries
  if (query.includes('swiggy') || query.includes('delivery') || query.includes('payout') || query.includes('സ്വിഗ്ഗി')) {
    toolsCalled.push('get_swiggy_details');
    const swiggy = await getSwiggyDetails(5);
    if ('error' in swiggy) {
      return {
        text: `സ്വിഗ്ഗി വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല ട്ടോ: ${swiggy.error}`,
        toolsCalled,
      };
    }

    return {
      text: `സ്വിഗ്ഗിയിൽ നിന്ന് ഇതുവരെ നമുക്ക് കയ്യിൽ കിട്ടിയ തുക ₹${swiggy.total_net_payout.toLocaleString('en-IN')} ആണ് ട്ടോ (പിടിക്കലുകൾക്ക് മുമ്പുള്ള ആകെ തുക ₹${swiggy.total_gross.toLocaleString('en-IN')}).`,
      toolsCalled,
    };
  }

  // 2. Debts and Dues
  if (query.includes('debt') || query.includes('lent') || query.includes('borrow') || query.includes('due') || query.includes('owe') || query.includes('കടം')) {
    toolsCalled.push('get_debts_and_dues');
    const debts = await getDebtsAndDues('pending');
    if ('error' in debts) {
      return {
        text: `കടത്തിന്റെ കണക്കുകൾ ഇപ്പോൾ എടുക്കാൻ കഴിഞ്ഞില്ല ട്ടോ: ${debts.error}`,
        toolsCalled,
      };
    }

    return {
      text: `മറ്റുള്ളവരിൽ നിന്ന് നമുക്ക് പിരിഞ്ഞു കിട്ടാൻ ₹${debts.total_lent_pending_to_receive.toLocaleString('en-IN')} ഉണ്ട്, അങ്ങോട്ട് കൊടുക്കാൻ ₹${debts.total_borrowed_pending_to_pay.toLocaleString('en-IN')} ഉണ്ട് ട്ടോ.`,
      toolsCalled,
    };
  }

  // 3. Grand Total or External Live Funds
  if (
    query.includes('grand total') || query.includes('total cash') || query.includes('മൊത്തം') ||
    query.includes('external') || query.includes('store') || query.includes('lab') || query.includes('room') ||
    query.includes('sheet') || query.includes('fund') || query.includes('ഫണ്ട്') || query.includes('സ്റ്റോർ') || query.includes('ലാബ്') || query.includes('റൂം')
  ) {
    toolsCalled.push('get_external_live_funds');
    const funds = await getExternalLiveFunds();
    const grand = funds.grand_total_cash?.amount ?? (
      Number(funds.store_fund?.amount || 0) +
      Number(funds.it_lab_fund?.amount || 0) +
      Number(funds.room_fund?.amount || 0) +
      Number(funds.my_cash?.amount || 0)
    );

    return {
      text: `ഇപ്പോ നമ്മുടെ കൈവശമുള്ള ആകെ തുക ₹${grand.toLocaleString('en-IN')} ഉണ്ട് ട്ടോ! (കടയിലെ പണം: ₹${funds.store_fund?.amount?.toLocaleString('en-IN') || 0}, ലാബിലെ പണം: ₹${funds.it_lab_fund?.amount?.toLocaleString('en-IN') || 0}, റൂമിലെ പണം: ₹${funds.room_fund?.amount?.toLocaleString('en-IN') || 0}, സ്വന്തം പണം: ₹${funds.my_cash?.amount?.toLocaleString('en-IN') || 0}).`,
      toolsCalled,
    };
  }

  // 4. Recent Transactions
  if (query.includes('transaction') || query.includes('recent') || query.includes('history') || query.includes('ഇടപാടുകൾ') || query.includes('കണക്ക്')) {
    toolsCalled.push('get_recent_transactions');
    const txData = await getRecentTransactions(5);
    if (!txData.transactions || txData.transactions.length === 0) {
      return {
        text: 'അടുത്തിടെയുള്ള കണക്കുകൾ ഒന്നും ചേർത്തിട്ടില്ല ട്ടോ.',
        toolsCalled,
      };
    }
    const list = txData.transactions
      .map((t: any) => `• ${formatDateDDMMYYYY(t.date)}: ${t.category} (${t.type === 'income' ? '+' : '-'}₹${t.amount.toLocaleString('en-IN')})`)
      .join('\n');
    return { text: `അടുത്തിടെ നടന്ന ഇടപാടുകൾ ഇതാ:\n${list}`, toolsCalled };
  }

  // 5. Default: Financial Overview & My Cash
  toolsCalled.push('get_financial_summary');
  const summary = await getFinancialSummary('month');
  return {
    text: `ഈ മാസം ഇതുവരെ ₹${summary.total_income?.toLocaleString('en-IN') || 0} വരവും ₹${summary.total_expense?.toLocaleString('en-IN') || 0} ചെലവും വന്നിട്ടുണ്ട്. ബാക്കി മിച്ചം ₹${summary.total_savings?.toLocaleString('en-IN') || 0} ഉണ്ട് ട്ടോ!`,
    toolsCalled,
  };
}

export async function POST(req: Request) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 });
    }

    const { messages } = body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const userPrompt = lastMessage.content || '';

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. If GEMINI_API_KEY is available:
    if (geminiKey && !geminiKey.includes('placeholder')) {
      try {
        const geminiModels = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.5-flash'];
        let geminiRes: Response | null = null;
        let usedModel = geminiModels[0];

        for (const model of geminiModels) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: messages.map((m: any) => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }],
                })),
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                tools: [
                  {
                    functionDeclarations: [
                      {
                        name: 'get_financial_summary',
                        description: 'Get total income, expense, savings, and My Cash personal net balance for current month or all time',
                        parameters: {
                          type: 'OBJECT',
                          properties: { period: { type: 'STRING', enum: ['month', 'all'] } },
                        },
                      },
                      {
                        name: 'get_swiggy_details',
                        description: 'Get Swiggy net earnings, gross payouts, and deduction breakdown',
                      },
                      {
                        name: 'get_debts_and_dues',
                        description: 'Get pending debts, money lent to others, money borrowed, and overdue dues',
                      },
                      {
                        name: 'get_external_live_funds',
                        description: 'Read live balances of Room Fund (Sheet cell B19), IT Lab Fund (Supabase), Store Fund (MongoDB), and combined Grand Total Cash',
                      },
                      {
                        name: 'get_recent_transactions',
                        description: 'Get recent transaction entries from the transactions table',
                      },
                    ],
                  },
                ],
              }),
            }
          );

          if (res.ok) {
            geminiRes = res;
            usedModel = model;
            break;
          }
        }

        if (geminiRes && geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidate = geminiData.candidates?.[0];
          const part = candidate?.content?.parts?.[0];

          // Check if functionCall was returned
          if (part?.functionCall) {
            const toolName = part.functionCall.name;
            const toolArgs = part.functionCall.args || {};
            const toolResult = await executeTool(toolName, toolArgs);

            // Send tool result back to Gemini for final response with complete candidate content
            const secondRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    ...messages.map((m: any) => ({
                      role: m.role === 'assistant' ? 'model' : 'user',
                      parts: [{ text: m.content }],
                    })),
                    candidate.content,
                    {
                      role: 'user',
                      parts: [
                        {
                          functionResponse: {
                            name: toolName,
                            response: { result: toolResult },
                          },
                        },
                      ],
                    },
                  ],
                  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                }),
              }
            );

            if (secondRes.ok) {
              const secondData = await secondRes.json();
              const finalText = secondData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (finalText) {
                return NextResponse.json({
                  role: 'assistant',
                  content: ensurePureMalayalam(finalText),
                  toolCalls: [toolName],
                });
              }
            }
          }

          if (part?.text) {
            return NextResponse.json({
              role: 'assistant',
              content: ensurePureMalayalam(part.text),
            });
          }
        }
      } catch (e) {
        console.error('Gemini API call failed, falling back to local finance engine:', e);
      }
    }

    // 2. If OPENAI_API_KEY is available:
    if (openaiKey && !openaiKey.includes('placeholder')) {
      try {
        const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...messages.map((m: any) => ({ role: m.role, content: m.content })),
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_financial_summary',
                  description: 'Get total income, expense, and savings for the current month or all time',
                  parameters: {
                    type: 'object',
                    properties: { period: { type: 'string', enum: ['month', 'all'] } },
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_swiggy_details',
                  description: 'Get Swiggy net earnings, gross payouts, and deduction breakdown',
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_debts_and_dues',
                  description: 'Get pending debts, money lent to others, money borrowed, and overdue dues',
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_external_live_funds',
                  description: 'Read live balances of Room Fund (Sheet cell B19), IT Lab Fund (Supabase), and Store Fund (MongoDB)',
                },
              },
            ],
            tool_choice: 'auto',
          }),
        });

        if (openAiRes.ok) {
          const openAiData = await openAiRes.json();
          const choice = openAiData.choices?.[0]?.message;

          if (choice?.tool_calls && choice.tool_calls.length > 0) {
            const toolCall = choice.tool_calls[0];
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');
            const result = await executeTool(name, args);

            // Follow-up call with tool result
            const secondOpenAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  ...messages.map((m: any) => ({ role: m.role, content: m.content })),
                  choice,
                  {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result),
                  },
                ],
              }),
            });

            if (secondOpenAiRes.ok) {
              const secondData = await secondOpenAiRes.json();
              const finalText = secondData.choices?.[0]?.message?.content;
              if (finalText) {
                return NextResponse.json({
                  role: 'assistant',
                  content: ensurePureMalayalam(finalText),
                  toolCalls: [name],
                });
              }
            }
          }

          if (choice?.content) {
            return NextResponse.json({
              role: 'assistant',
              content: ensurePureMalayalam(choice.content),
            });
          }
        }
      } catch (e) {
        console.error('OpenAI API call failed, falling back to local finance engine:', e);
      }
    }

    // 3. Fallback: Local Financial Engine (Direct Supabase & Live Funds Query)
    const { text, toolsCalled } = await fallbackFinancialEngine(userPrompt);
    return NextResponse.json({
      role: 'assistant',
      content: ensurePureMalayalam(text),
      toolCalls: toolsCalled,
    });
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error in AI Assistant' },
      { status: 500 }
    );
  }
}

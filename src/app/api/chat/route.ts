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

const SYSTEM_PROMPT = `You are a concise, professional Personal Finance AI Assistant for Cash Manager.
You have access to tools that query the user's live Supabase database and external live funds.
Always use your tools to provide accurate figures with the INR (₹) symbol.
Answer strictly based on the database data. Keep answers brief, natural, and conversational (1 to 3 sentences) suitable for real-time live voice output and chat. Avoid large tables or excessive asterisks when simple spoken sentences work best.`;

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

// Fallback intelligent agent (when no OpenAI/Gemini API key is configured yet)
async function fallbackFinancialEngine(userQuery: string) {
  const query = userQuery.toLowerCase();
  const toolsCalled: string[] = [];

  if (query.includes('swiggy') || query.includes('delivery') || query.includes('payout')) {
    toolsCalled.push('get_swiggy_details');
    const swiggy = await getSwiggyDetails(5);
    if ('error' in swiggy) return { text: `Unable to fetch Swiggy details: ${swiggy.error}`, toolsCalled };

    return {
      text: `**Swiggy Summary:**\n• Total Net Payout: ₹${swiggy.total_net_payout.toLocaleString('en-IN')}\n• Gross Amount: ₹${swiggy.total_gross.toLocaleString('en-IN')}\n• Total Deductions: ₹${swiggy.total_deductions.toLocaleString('en-IN')}\n• Recent Payouts Recorded: ${swiggy.recent_payouts.length}`,
      toolsCalled,
    };
  }

  if (query.includes('debt') || query.includes('lent') || query.includes('borrow') || query.includes('due') || query.includes('owe')) {
    toolsCalled.push('get_debts_and_dues');
    const debts = await getDebtsAndDues('pending');
    if ('error' in debts) return { text: `Unable to fetch debts: ${debts.error}`, toolsCalled };

    let reply = `**Debts & Dues:**\n• Money Lent (To Receive): ₹${debts.total_lent_pending_to_receive.toLocaleString('en-IN')}\n• Money Borrowed (To Pay): ₹${debts.total_borrowed_pending_to_pay.toLocaleString('en-IN')}\n• Net Balance: ₹${debts.net_balance.toLocaleString('en-IN')}`;

    if (debts.overdue_count > 0 && debts.overdue_dues) {
      reply += `\n\n⚠️ **${debts.overdue_count} Overdue Item(s):**\n` +
        debts.overdue_dues.map((d: any) => `• ${d.person}: ₹${d.amount} (${d.overdue_by_days} days overdue)`).join('\n');
    }
    return { text: reply, toolsCalled };
  }

  if (query.includes('external') || query.includes('store') || query.includes('lab') || query.includes('room') || query.includes('sheet') || query.includes('fund')) {
    toolsCalled.push('get_external_live_funds');
    const funds = await getExternalLiveFunds();
    return {
      text: `**External Live Funds:**\n• Room Fund (Sheet Cell B19): ₹${funds.room_fund?.amount?.toLocaleString('en-IN') || 0}\n• IT Lab Print Fund (Supabase): ₹${funds.it_lab_fund?.amount?.toLocaleString('en-IN') || 0}\n• Store Fund (MongoDB Trial Balance): ₹${funds.store_fund?.amount?.toLocaleString('en-IN') || 0}`,
      toolsCalled,
    };
  }

  if (query.includes('transaction') || query.includes('recent') || query.includes('history')) {
    toolsCalled.push('get_recent_transactions');
    const txData = await getRecentTransactions(5);
    if (!txData.transactions || txData.transactions.length === 0) {
      return { text: 'You have no recent transactions recorded in the database.', toolsCalled };
    }
    const list = txData.transactions
      .map((t: any) => `• ${formatDateDDMMYYYY(t.date)}: ${t.category} (${t.type === 'income' ? '+' : '-'}₹${t.amount.toLocaleString('en-IN')})`)
      .join('\n');
    return { text: `**Recent Transactions:**\n${list}`, toolsCalled };
  }

  // Default: Financial Overview (income, expense, savings)
  toolsCalled.push('get_financial_summary');
  const summary = await getFinancialSummary('month');
  return {
    text: `**Current Month Financial Overview:**\n• Total Income: ₹${summary.total_income?.toLocaleString('en-IN') || 0}\n• Total Expenses: ₹${summary.total_expense?.toLocaleString('en-IN') || 0}\n• Total Savings: ₹${summary.total_savings?.toLocaleString('en-IN') || 0} (${summary.savings_rate_percentage || '0%'} rate)\n\nYou can ask me specifically about your Swiggy payouts, pending debts, external funds, or recent transactions.`,
    toolsCalled,
  };
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
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
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
                      description: 'Get total income, expense, and savings for the current month or all time',
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
                      description: 'Read live balances of Room Fund (Sheet cell B19), IT Lab Fund (Supabase), and Store Fund (MongoDB)',
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

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidate = geminiData.candidates?.[0];
          const part = candidate?.content?.parts?.[0];

          // Check if functionCall was returned
          if (part?.functionCall) {
            const toolName = part.functionCall.name;
            const toolArgs = part.functionCall.args || {};
            const toolResult = await executeTool(toolName, toolArgs);

            // Send tool result back to Gemini for final response
            const secondRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    ...messages.map((m: any) => ({
                      role: m.role === 'assistant' ? 'model' : 'user',
                      parts: [{ text: m.content }],
                    })),
                    { role: 'model', parts: [{ functionCall: part.functionCall }] },
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
                  content: finalText,
                  toolCalls: [toolName],
                });
              }
            }
          }

          if (part?.text) {
            return NextResponse.json({ role: 'assistant', content: part.text });
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
                  content: finalText,
                  toolCalls: [name],
                });
              }
            }
          }

          if (choice?.content) {
            return NextResponse.json({ role: 'assistant', content: choice.content });
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
      content: text,
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

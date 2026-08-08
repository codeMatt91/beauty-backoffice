import { format, startOfMonth, endOfMonth } from "date-fns";
import { getFinancialSummary, getExpenses } from "@/actions/expenses";
import { getServiceTypes } from "@/actions/serviceTypes";
import FinanceClient from "@/components/finance/FinanceClient";

export default async function FinancePage() {
  const from = startOfMonth(new Date());
  const to = endOfMonth(new Date());

  const [financialData, expenses, serviceTypes] = await Promise.all([
    getFinancialSummary(from, to),
    getExpenses(from, to),
    getServiceTypes(),
  ]);

  return (
    <FinanceClient
      initialData={financialData}
      initialExpenses={expenses}
      initialServiceTypes={serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
      initialDateFrom={format(from, "yyyy-MM-dd")}
      initialDateTo={format(to, "yyyy-MM-dd")}
    />
  );
}

import { getCustomers } from "@/actions/customers";
import CustomersClient from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return <CustomersClient initialCustomers={JSON.parse(JSON.stringify(customers))} />;
}

import { getAllUsers } from "@/actions/users";
import EmployeesClient from "@/components/employees/EmployeesClient";
import { UserRecord } from "@/components/employees/UserTable";

export default async function EmployeesPage() {
  const users = await getAllUsers();

  return <EmployeesClient initialUsers={JSON.parse(JSON.stringify(users)) as UserRecord[]} />;
}

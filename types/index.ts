import { Role, PaymentStatus, ExpenseCategory } from "@prisma/client";

export type { Role, PaymentStatus, ExpenseCategory };

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AppointmentWithRelations {
  id: string;
  customerId: string;
  employeeId: string | null;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  price: string; // Decimal serialized as string
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdAt: Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
  };
  employee: {
    id: string;
    name: string;
  } | null;
}

export interface CustomerWithStats {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  age: number | null;
  notes: string | null;
  createdAt: Date;
  _count: { appointments: number };
}

export interface FinancialSummary {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface PurgeOptions {
  olderThanMonths: number;
}

import { getServiceTypes } from "@/actions/serviceTypes";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const serviceTypes = await getServiceTypes();

  return <SettingsClient initialServiceTypes={serviceTypes} />;
}

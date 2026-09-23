import { requireUser } from "@/lib/auth/session";
import { VisitaWizard } from "../VisitaWizard";

export default async function NovaVisitaPage() {
  const user = await requireUser();
  return <VisitaWizard tecnicoNomeSugerido={user.name} />;
}

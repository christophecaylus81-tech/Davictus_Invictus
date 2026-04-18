import { codeAssistantModule } from "./codeAssistant";
import { computerUseModule } from "./computerUse";
import { emailsModule } from "./emails";
import { longReportsModule } from "./longReports";
import { planningModule } from "./planning";
import { veilleModule } from "./veille";

export type ModuleStatus = "mvp" | "stub";

export interface ModuleDescriptor {
  key: string;
  label: string;
  status: ModuleStatus;
  description: string;
}

const mvpModules: ModuleDescriptor[] = [
  {
    key: "interface.telegram",
    label: "Interface Telegram",
    status: "mvp",
    description: "Cockpit principal v1 pour capturer et traiter les entrées utilisateur."
  },
  {
    key: "inbox",
    label: "Inbox Universelle",
    status: "mvp",
    description: "Réception centralisée des éléments entrants."
  },
  {
    key: "gtd",
    label: "Moteur GTD",
    status: "mvp",
    description: "Classification simple en tâche, projet, archive, incubateur ou bruit."
  },
  {
    key: "projects.tasks",
    label: "Projets et Tâches",
    status: "mvp",
    description: "Base de gestion des projets et tâches générés depuis l'inbox."
  }
];

export const moduleRegistry: ModuleDescriptor[] = [
  ...mvpModules,
  planningModule,
  emailsModule,
  veilleModule,
  longReportsModule,
  codeAssistantModule,
  computerUseModule
];

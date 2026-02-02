import { createContext, useContext, useState, ReactNode } from "react";

interface SelectedEntity {
  type: "job" | "lead" | "quote" | "contact" | null;
  id: string | null;
  name: string | null;
  details?: Record<string, unknown>;
}

interface AIContextType {
  selectedEntity: SelectedEntity;
  setSelectedEntity: (entity: SelectedEntity) => void;
  clearSelectedEntity: () => void;
}

const defaultEntity: SelectedEntity = {
  type: null,
  id: null,
  name: null,
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(defaultEntity);

  const clearSelectedEntity = () => setSelectedEntity(defaultEntity);

  return (
    <AIContext.Provider value={{ selectedEntity, setSelectedEntity, clearSelectedEntity }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error("useAIContext must be used within an AIContextProvider");
  }
  return context;
}

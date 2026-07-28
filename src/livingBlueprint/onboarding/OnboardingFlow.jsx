import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { loadOnboardingState, saveOnboardingState } from "./storage";
import Step1Welcome from "./steps/Step1Welcome";
import Step2WhoIsJoining from "./steps/Step2WhoIsJoining";
import Step3FamilyMembers from "./steps/Step3FamilyMembers";
import Step4QuickQuestions from "./steps/Step4QuickQuestions";
import Step5BuildingBlueprint from "./steps/Step5BuildingBlueprint";
import Step6BlueprintReady from "./steps/Step6BlueprintReady";

// Rebuild prompt section 5 — the six-step onboarding flow, orchestrated.
// Step numbering here follows user-visible progress (1-4 shown as dots in
// StepShell); Steps 5-6 are the transition/completion moments and render
// full-screen without the shared chrome, matching the spec's layout.
//
// Family members (Step 3) is skipped entirely when accountType !== "family".
export default function OnboardingFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(() => loadOnboardingState(user?.uid));

  // Reload once the real uid resolves (dev-preview mounts before auth settles).
  useEffect(() => {
    if (user?.uid) setState(loadOnboardingState(user.uid));
  }, [user?.uid]);

  useEffect(() => {
    saveOnboardingState(user?.uid, state);
  }, [state, user?.uid]);

  const patch = (fields) => setState(s => ({ ...s, ...fields }));
  const goToStep = (step) => setState(s => ({ ...s, step }));

  const learners = state.accountType === "family" && state.familyMembers.length
    ? state.familyMembers
    : [{ id: "self", name: user?.name || "You" }];

  switch (state.step) {
    case 1:
      return <Step1Welcome onNext={() => goToStep(2)} />;

    case 2:
      return (
        <Step2WhoIsJoining
          value={state.accountType}
          onChange={(accountType) => patch({ accountType })}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(state.accountType === "family" ? 3 : 4)}
        />
      );

    case 3:
      return (
        <Step3FamilyMembers
          members={state.familyMembers}
          onChange={(familyMembers) => patch({ familyMembers })}
          onBack={() => goToStep(2)}
          onNext={() => goToStep(4)}
        />
      );

    case 4:
      return (
        <Step4QuickQuestions
          learners={learners}
          answers={state.answers}
          onChange={(answers) => patch({ answers })}
          onBack={() => goToStep(state.accountType === "family" ? 3 : 2)}
          onNext={() => goToStep(5)}
        />
      );

    case 5:
      return <Step5BuildingBlueprint onDone={() => goToStep(6)} />;

    case 6:
      return (
        <Step6BlueprintReady
          onFinish={() => navigate("/preview/shell")}
        />
      );

    default:
      return <Step1Welcome onNext={() => goToStep(2)} />;
  }
}

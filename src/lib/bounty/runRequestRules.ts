// SV-21 P1: who is offered "Open a request from this run". Pure, so a view and a model can use it without the database.

export const REQUEST_FROM_RUN_LABEL = "Open a request from this run";

/** Whether the viewer is offered the button on a run: they made the build and the run did not work. */
export const canOpenFromRun = (run: { worked: boolean }, buildMakerId: string | null | undefined, viewerId: string | null | undefined): boolean =>
  !run.worked && !!viewerId && viewerId === buildMakerId;

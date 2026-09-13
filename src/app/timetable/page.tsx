import { redirect } from "next/navigation";

export default function TimetablePage() {
  redirect("/calendar?view=timetable");
}

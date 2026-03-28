"use client";

import { useParams } from "next/navigation";

import MemberFairnessView from "@/app/components/fairness/MemberFairnessView";

export default function FairnessMemberDetailPage() {
  const params = useParams<{ memberId: string }>();

  return <MemberFairnessView mode="leadership" memberId={params.memberId} />;
}

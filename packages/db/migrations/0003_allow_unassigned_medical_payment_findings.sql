alter table findings
  drop constraint if exists findings_finding_type_check;

alter table findings
  add constraint findings_finding_type_check
  check (
    finding_type in (
      'possible_credit',
      'allocation_unclear',
      'questionable_canceled_charge',
      'claim_in_process',
      'unmatched_payment',
      'unassigned_medical_payment'
    )
  );

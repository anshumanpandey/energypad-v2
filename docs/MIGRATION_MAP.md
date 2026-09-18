# Legacy to V2 migration map

Sprint 0, 17 September 2026. Proposed logical destinations; no Prisma schema or migration adapter is implemented. This map covers the root migration source, root API schemas, nested models, UI contracts and import layouts. Production schema and historical data remain unverified.

## Identity, ownership and reconciliation rules

1. Give each destination entity a UUID. Preserve the original identifier as `externalLegacyId` with `sourceSystem` and source table; never merge independent MySQL and PostgreSQL IDs by number alone. Retain an explicit mapping ledger.
2. Businesses combines organisation and login identity. Split its organisation/contact fields from User and Membership. Match identities using approved email normalization/verification rules, not arbitrary fuzzy matching. Never migrate password hashes, plaintext credentials or reusable sessions.
3. Root Sites.businessId determines source ownership. Site descendants inherit organisation ownership through a verified site mapping; business descendants through a verified business mapping. Orphans, conflicting ownership and cross-tenant foreign keys go to a rejection queue.
4. Fuel/unit/country catalogs can be platform-managed. Customer overrides, factors, tariffs, observations and derived results need scope and provenance. Global old IDs must be resolved by explicit reference maps, not retained as new primary keys.
5. Store source quantities and units alongside normalized decimal values. Parse money/carbon as decimal; rounding occurs under versioned policy, not opportunistically during intermediate operations. Preserve null separately from zero.
6. Monthly data becomes a site-local reporting period with explicit period boundaries; audit timestamps are UTC. Resolve source timezone/date strings before translating to timestamps. Do not invent a historical effective date for a present-day site attribute.
7. Import batch IDs, row identifiers, source checksum, schema version, correction lineage and idempotency keys are new metadata. Migration retries must be deterministic and transactional.
8. Reconcile counts by organisation/site and consumption by month/fuel/unit, then normalized quantities, cost/VAT and carbon. Explain calculation differences through approved compatibility decisions rather than forcing totals to legacy bugs. Keep old reports as legacy evidence and new results as separately versioned calculations.

## Root table mapping

The following is a static projection of ordered `up` migrations. Dropped columns/tables are listed separately; constraints and database-specific runtime behaviour still require schema export. The newest declared field type is shown in the detailed map, not a guarantee of the deployed schema.

| Source table | Observed surviving fields | Proposed destination | Disposition / sprint |
| --- | --- | --- | --- |
| BusinessBrands | id, name, startTime, endTime, rate, days, fuelSourceId, siteId, usedInId | TariffTimeBand | Redesign / 3 |
| BusinessFuelUses | id, siteId, fuelSourceId, usedInId | SiteEnergyEndUse | Retain / 3 |
| BusinessFuelsPricing | id, currencyCode, vat, fuelSourceId, siteId, usedInId | TariffVersion | Redesign / 3 |
| BusinessFuelsSize | id, meters, fuelSourceId, siteId, usedInId | Meter | Redesign / 2 |
| BusinessLog | id, startDate, endDate, comments, operation, siteId, usedInId | OperationalEvent | Redesign / 3 |
| BusinessPatterns | id, startDate, endDate, daysOnYear, siteId, usedInId, temperature | OperatingSchedule / DriverObservation | Redesign / 3 |
| BusinessTenant | id, date, regularTenantAmount, irregularTenantAmount, siteId, usedInId | OccupancyObservation | Retain / 3 |
| Businesses | id, businessName, businessType, businessService, password, buildingName, contactName, position, phoneNumber, email, town, postCode, subscriptionDate, countryId, stateId, currencyCode, address_1 | Organisation + User/Membership | Redesign / 1 |
| Countries | id, name | Country | Retain / 2 |
| EnergySavingTips | id, category, text, imageUrl | InvestigationTemplate | Redesign / 6 |
| EnergySavingTipsToBusiness | businessId, tipId, month, use, siteId | SiteRecommendation | Redesign / 6 |
| Floors | id, size, area, population, businessId | LegacySpaceRecord / optional SiteSpace | Redesign / 2 |
| FuelSources | id, source, colorCode | EnergySource/FuelType | Retain / 3 |
| FuelUses | id, use | EndUse | Retain / 3 |
| ProgrammeAnswers | id, answer, programmeId | ActionChecklistAnswer | Retain / 6 |
| Programmes | id, question, siteId, usedInId | ActionChecklist | Redesign / 6 |
| Reviews | id, question, siteId | SiteReview | Redesign / 6 |
| ReviewsAnswers | id, answer, reviewId | SiteReviewAnswer | Retain / 6 |
| SiteConversionUnits | id, unitType, unitValue, siteId | UnitConversionVersion | Redesign / 3 |
| Sites | id, type, address, postCode, town, size, businessId, fullTimeEmployee, name, countryId, stateId, code, vat | Site | Retain / 2 |
| States | id, name, countryId | Region | Retain / 2 |
| TargetConsumption | id, date, fuelSourceId, siteId | Target | Redesign / 5 |
| TargetConsumptionFuelConversion | id, targetValue, fuelUnit, targetConsumptionId, targetCarbon | TargetValue | Redesign / 5 |
| UsedInToFuelSourceToSite | id, fuelSourceId, usedInId, siteId | SiteEnergyEndUse | Redesign / 3 |
| Utilities | id, name, businessId | LegacyUtilityReference | Redesign / 3 |
| UtilityConsumptions | id, date, consumption, fuelSourceId, siteId, totalCost, conversionFactor, fuelUnit, vat, created_at, updated_at, usedInId, vatCost, population, workingHours | ConsumptionRecord | Redesign / 3 |
| UtilityEmissions | id, fuelSourceId, siteId, conversionFactor, fuelUnit, emissionFactor, date, created_at, updated_at | EmissionFactorVersion | Redesign / 5 |
| UtilityMonitoring | id, energy, carbon, conversionFactor, fuelUnit, date, siteId, fuelSourceId, created_at, updated_at | MonitoringTarget | Redesign / 5 |
| UtilityMonitoringToUseInId | id, monitoringId, usedInId, created_at, updated_at | TargetEndUse | Retain / 5 |
| UtilityToDriver | id, driver, category, siteId | BaselineDriverPolicy | Redesign / 4 |

## Detailed root field transformations

Common policy: all retained rows preserve source identity; foreign keys are remapped only after parent ownership validation; every value retains source/batch provenance. “Preserve field” means on the proposed logical entity, subject to explicit schema naming during Sprint 1; it is not permission to store opaque payloads instead of normalized domains.

| Source field | Declared type | V2 field/concept | Transformation and validation | Latest declaration |
| --- | --- | --- | --- | --- |
| BusinessBrands.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.name | string | TariffTimeBand.name | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.startTime | string | TariffTimeBand.startTime | Preserve time band; verify timezone, weekdays and rate unit/currency before valuation. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.endTime | string | TariffTimeBand.endTime | Preserve time band; verify timezone, weekdays and rate unit/currency before valuation. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.rate | integer | TariffTimeBand.rate | Preserve time band; verify timezone, weekdays and rate unit/currency before valuation. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.days | string | TariffTimeBand.days | Preserve time band; verify timezone, weekdays and rate unit/currency before valuation. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessBrands.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20220113173107_business_energy_2.ts:14](../migrations/20220113173107_business_energy_2.ts#L14) |
| BusinessFuelUses.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelUses.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelUses.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelUses.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.currencyCode | string | currencyCode | Validate currency; never aggregate currencies implicitly. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.vat | integer | taxRate | Confirm percent vs fraction and gross/net semantics before conversion. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsPricing.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20220113173107_business_energy_2.ts:9](../migrations/20220113173107_business_energy_2.ts#L9) |
| BusinessFuelsSize.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsSize.meters | string | Meter.externalReference | Parse list/string deliberately; multiple meter IDs need reviewed split; do not invent allocation of site-level consumption. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsSize.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsSize.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| BusinessFuelsSize.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20220113173107_business_energy_2.ts:4](../migrations/20220113173107_business_energy_2.ts#L4) |
| BusinessLog.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.startDate | string | startDate | Parse source date, retain interval semantics and validate ordering/overlaps. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.endDate | string | endDate | Parse source date, retain interval semantics and validate ordering/overlaps. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.comments | string | OperationalEvent.comments | Preserve evidence text; do not infer approval or verified savings. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.operation | string | OperationalEvent.operation | Preserve evidence text; do not infer approval or verified savings. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessLog.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20211213175444_business_log.ts:4](../migrations/20211213175444_business_log.ts#L4) |
| BusinessPatterns.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| BusinessPatterns.startDate | string | startDate | Parse source date, retain interval semantics and validate ordering/overlaps. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| BusinessPatterns.endDate | string | endDate | Parse source date, retain interval semantics and validate ordering/overlaps. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| BusinessPatterns.daysOnYear | integer | OperatingSchedule.activeDays | Validate against date interval; preserve source if discrepancy for review. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| BusinessPatterns.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211213040401_business_pattern.ts:5](../migrations/20211213040401_business_pattern.ts#L5) |
| BusinessPatterns.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20211213040401_business_pattern.ts:5](../migrations/20211213040401_business_pattern.ts#L5) |
| BusinessPatterns.temperature | integer | DriverDefinition.baseTemperature | Confirm Celsius and heating/cooling context; version methodology. | [migrations/20230601222114_business_pattern_unique.ts:4](../migrations/20230601222114_business_pattern_unique.ts#L4) |
| BusinessTenant.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| BusinessTenant.date | string | periodStart/periodEnd or effectiveFrom | Validate monthly date and timezone; emissions effective interval requires policy. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| BusinessTenant.regularTenantAmount | integer | OccupancyObservation.regularTenantAmount | Preserve separate counts and time period; not SaaS tenants/users. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| BusinessTenant.irregularTenantAmount | integer | OccupancyObservation.irregularTenantAmount | Preserve separate counts and time period; not SaaS tenants/users. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| BusinessTenant.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| BusinessTenant.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20211213181052_business_tenant.ts:4](../migrations/20211213181052_business_tenant.ts#L4) |
| Businesses.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.businessName | string | Organisation.name | Preserve descriptive business meaning. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.businessType | string | Organisation.type | Preserve descriptive business meaning. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.businessService | string | Organisation.service | Preserve descriptive business meaning. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.password | string | Excluded | Do not copy; invite/activate securely. Source retained only under legacy access controls. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.buildingName | string | Organisation legacy building label | Do not assign a particular site without a verified relation. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.contactName | string | User invitation / OrganisationContact.contactName | Personal data; separate login email from business contact, normalize/validate under retention policy. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.position | string | User invitation / OrganisationContact.position | Personal data; separate login email from business contact, normalize/validate under retention policy. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.phoneNumber | string | User invitation / OrganisationContact.phoneNumber | Personal data; separate login email from business contact, normalize/validate under retention policy. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.email | string | User invitation / OrganisationContact.email | Personal data; separate login email from business contact, normalize/validate under retention policy. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.town | string | OrganisationAddress.town | Preserve text and postal formatting; no geocoding inference. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.postCode | string | OrganisationAddress.postCode | Preserve text and postal formatting; no geocoding inference. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Businesses.subscriptionDate | string | legacySubscriptionStartedAt | Historical metadata only; does not establish Stripe entitlement. | [migrations/20230622234526_business_subscriptionDate.ts:4](../migrations/20230622234526_business_subscriptionDate.ts#L4) |
| Businesses.countryId | integer | countryCode / regionId | Resolve reference catalog; IDs from old DB are not globally meaningful. | [migrations/20220315203747_countries.ts:15](../migrations/20220315203747_countries.ts#L15) |
| Businesses.stateId | integer | countryCode / regionId | Resolve reference catalog; IDs from old DB are not globally meaningful. | [migrations/20230531184856_business_state_optional.ts:4](../migrations/20230531184856_business_state_optional.ts#L4) |
| Businesses.currencyCode | string | currencyCode | Validate currency; never aggregate currencies implicitly. | [migrations/20220922133258_currency_1.ts:4](../migrations/20220922133258_currency_1.ts#L4) |
| Businesses.address_1 | string | OrganisationAddress.address_1 | Preserve text and postal formatting; no geocoding inference. | [migrations/20221205164121_business_address.ts:4](../migrations/20221205164121_business_address.ts#L4) |
| Countries.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20220315203747_countries.ts:4](../migrations/20220315203747_countries.ts#L4) |
| Countries.name | string | Country.name | Preserve field with source provenance; validate type, length and entity association. | [migrations/20220315203747_countries.ts:4](../migrations/20220315203747_countries.ts#L4) |
| EnergySavingTips.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212024743_energy_saving_tips.ts:4](../migrations/20211212024743_energy_saving_tips.ts#L4) |
| EnergySavingTips.category | string | InvestigationTemplate.category | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211212024743_energy_saving_tips.ts:4](../migrations/20211212024743_energy_saving_tips.ts#L4) |
| EnergySavingTips.text | string | InvestigationTemplate.text | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211212024743_energy_saving_tips.ts:4](../migrations/20211212024743_energy_saving_tips.ts#L4) |
| EnergySavingTips.imageUrl | string | templateMediaReference | Validate source/license/access before copying; no remote asset fetched in discovery. | [migrations/20211212024743_energy_saving_tips.ts:4](../migrations/20211212024743_energy_saving_tips.ts#L4) |
| EnergySavingTipsToBusiness.businessId | integer | organisationId | Resolve source Businesses; validate ownership. | [migrations/20241009063913_tips_user_mapping.ts:4](../migrations/20241009063913_tips_user_mapping.ts#L4) |
| EnergySavingTipsToBusiness.tipId | integer | templateId | Resolve EnergySavingTips and ownership of assignment. | [migrations/20241009063913_tips_user_mapping.ts:4](../migrations/20241009063913_tips_user_mapping.ts#L4) |
| EnergySavingTipsToBusiness.month | integer | recommendationPeriod | Legacy assignment lacks year; do not fabricate chronology. | [migrations/20241009063913_tips_user_mapping.ts:4](../migrations/20241009063913_tips_user_mapping.ts#L4) |
| EnergySavingTipsToBusiness.use | string | endUseReference | Resolve free-text labels without assuming globally unique names. | [migrations/20241009063913_tips_user_mapping.ts:4](../migrations/20241009063913_tips_user_mapping.ts#L4) |
| EnergySavingTipsToBusiness.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20241011120551_tip_user_siteid.ts:4](../migrations/20241011120551_tip_user_siteid.ts#L4) |
| Floors.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Floors.size | string | floorArea or sourceSize | Confirm physical unit and meaning; Floors.size is string while Sites.size is integer. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Floors.area | integer | LegacySpaceRecord / optional SiteSpace.area | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Floors.population | integer | DriverObservation(population) | Monthly source observation for consumption rows; historical attribute for floors. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| Floors.businessId | integer | organisationId | Resolve source Businesses; validate ownership. | [migrations/20211109190309_users_table.ts:4](../migrations/20211109190309_users_table.ts#L4) |
| FuelSources.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| FuelSources.source | string | EnergySource.name | Retain fuel semantics; approved canonical catalog mapping. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| FuelSources.colorCode | string | displayColor | Presentation metadata only; preserve valid value or use V2 palette. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| FuelUses.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| FuelUses.use | string | EndUse.name | Resolve free-text labels without assuming globally unique names. | [migrations/20211212054148_fuel_props.ts:4](../migrations/20211212054148_fuel_props.ts#L4) |
| ProgrammeAnswers.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211209162755_programmes.ts:4](../migrations/20211209162755_programmes.ts#L4) |
| ProgrammeAnswers.answer | string | ActionChecklistAnswer.answer | Preserve exact text and parent relationship; migrate as historical evidence. | [migrations/20211209162755_programmes.ts:4](../migrations/20211209162755_programmes.ts#L4) |
| ProgrammeAnswers.programmeId | integer | checklistId | Map parent Programmes row and inherit tenant/site scope. | [migrations/20211209162755_programmes.ts:4](../migrations/20211209162755_programmes.ts#L4) |
| Programmes.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211209162755_programmes.ts:4](../migrations/20211209162755_programmes.ts#L4) |
| Programmes.question | string | ActionChecklist.question | Preserve exact text and parent relationship; migrate as historical evidence. | [migrations/20211209162755_programmes.ts:4](../migrations/20211209162755_programmes.ts#L4) |
| Programmes.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211213191706_programmes_2.ts:4](../migrations/20211213191706_programmes_2.ts#L4) |
| Programmes.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20211213191706_programmes_2.ts:4](../migrations/20211213191706_programmes_2.ts#L4) |
| Reviews.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| Reviews.question | string | SiteReview.question | Preserve exact text and parent relationship; migrate as historical evidence. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| Reviews.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| ReviewsAnswers.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| ReviewsAnswers.answer | string | SiteReviewAnswer.answer | Preserve exact text and parent relationship; migrate as historical evidence. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| ReviewsAnswers.reviewId | integer | reviewId | Map parent Reviews row and inherit tenant/site scope. | [migrations/20211213221453_business_review.ts:4](../migrations/20211213221453_business_review.ts#L4) |
| SiteConversionUnits.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20220927144429_site_conversion_unit.ts:4](../migrations/20220927144429_site_conversion_unit.ts#L4) |
| SiteConversionUnits.unitType | string | UnitConversionVersion.sourceUnitId | Clarify whether old site-specific value is conversion or normalization driver. | [migrations/20220927144429_site_conversion_unit.ts:4](../migrations/20220927144429_site_conversion_unit.ts#L4) |
| SiteConversionUnits.unitValue | float | UnitConversionVersion.value | Validate dimension before treating as conversion. | [migrations/20220927144429_site_conversion_unit.ts:4](../migrations/20220927144429_site_conversion_unit.ts#L4) |
| SiteConversionUnits.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20220927144429_site_conversion_unit.ts:4](../migrations/20220927144429_site_conversion_unit.ts#L4) |
| Sites.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.type | string | Site.type | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.address | string | SiteAddress.address | Preserve text and postal formatting; no geocoding inference. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.postCode | string | SiteAddress.postCode | Preserve text and postal formatting; no geocoding inference. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.town | string | SiteAddress.town | Preserve text and postal formatting; no geocoding inference. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.size | integer | floorArea or sourceSize | Confirm physical unit and meaning; Floors.size is string while Sites.size is integer. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.businessId | integer | organisationId | Resolve source Businesses; validate ownership. | [migrations/20211111150106_sites_table.ts:4](../migrations/20211111150106_sites_table.ts#L4) |
| Sites.fullTimeEmployee | boolean | SiteAttributeHistory(fullTimeEmployee) | Preserve boolean; not a substitute for hours or population. | [migrations/20220923161813_site_employee_time.ts:4](../migrations/20220923161813_site_employee_time.ts#L4) |
| Sites.name | string | Site.name | Preserve field with source provenance; validate type, length and entity association. | [migrations/20221011155047_site_unique_name.ts:4](../migrations/20221011155047_site_unique_name.ts#L4) |
| Sites.countryId | integer | countryCode / regionId | Resolve reference catalog; IDs from old DB are not globally meaningful. | [migrations/20221208160430_site_country.ts:4](../migrations/20221208160430_site_country.ts#L4) |
| Sites.stateId | integer | countryCode / regionId | Resolve reference catalog; IDs from old DB are not globally meaningful. | [migrations/20221208160430_site_country.ts:4](../migrations/20221208160430_site_country.ts#L4) |
| Sites.code | string | Site.externalReference | Unique within org/source; preserve original code. | [migrations/20230626164347_site_code.ts:4](../migrations/20230626164347_site_code.ts#L4) |
| Sites.vat | float | taxRate | Confirm percent vs fraction and gross/net semantics before conversion. | [migrations/20230628140018_site_vat.ts:4](../migrations/20230628140018_site_vat.ts#L4) |
| States.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20220315203747_countries.ts:9](../migrations/20220315203747_countries.ts#L9) |
| States.name | string | Region.name | Preserve field with source provenance; validate type, length and entity association. | [migrations/20220315203747_countries.ts:9](../migrations/20220315203747_countries.ts#L9) |
| States.countryId | integer | countryCode / regionId | Resolve reference catalog; IDs from old DB are not globally meaningful. | [migrations/20220315203747_countries.ts:9](../migrations/20220315203747_countries.ts#L9) |
| TargetConsumption.id | string | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20260612073555_waste_config_sheet.ts:22](../migrations/20260612073555_waste_config_sheet.ts#L22) |
| TargetConsumption.date | string | periodStart/periodEnd or effectiveFrom | Validate monthly date and timezone; emissions effective interval requires policy. | [migrations/20221212195034_consumption_emission_target.ts:4](../migrations/20221212195034_consumption_emission_target.ts#L4) |
| TargetConsumption.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20221212195034_consumption_emission_target.ts:4](../migrations/20221212195034_consumption_emission_target.ts#L4) |
| TargetConsumption.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20221212195034_consumption_emission_target.ts:4](../migrations/20221212195034_consumption_emission_target.ts#L4) |
| TargetConsumptionFuelConversion.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20221212195034_consumption_emission_target.ts:12](../migrations/20221212195034_consumption_emission_target.ts#L12) |
| TargetConsumptionFuelConversion.targetValue | float | TargetValue.targetValue | Keep physical quantity, unit and target type; never mix measured data and desired target. | [migrations/20221212195034_consumption_emission_target.ts:12](../migrations/20221212195034_consumption_emission_target.ts#L12) |
| TargetConsumptionFuelConversion.fuelUnit | string | sourceUnitId | Normalize spelling; L/m3/kWh initial map; no silent unsupported-unit fallback. | [migrations/20221212195034_consumption_emission_target.ts:12](../migrations/20221212195034_consumption_emission_target.ts#L12) |
| TargetConsumptionFuelConversion.targetConsumptionId | string | targetId | Map parent TargetConsumption string/ULID identity. | [migrations/20260612073555_waste_config_sheet.ts:26](../migrations/20260612073555_waste_config_sheet.ts#L26) |
| TargetConsumptionFuelConversion.targetCarbon | float | TargetValue.targetCarbon | Keep physical quantity, unit and target type; never mix measured data and desired target. | [migrations/20260712224525_TargetConsimptionTargetCarbon.ts:4](../migrations/20260712224525_TargetConsimptionTargetCarbon.ts#L4) |
| UsedInToFuelSourceToSite.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20220117153702_fuel_sources.ts:7](../migrations/20220117153702_fuel_sources.ts#L7) |
| UsedInToFuelSourceToSite.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20220117153702_fuel_sources.ts:7](../migrations/20220117153702_fuel_sources.ts#L7) |
| UsedInToFuelSourceToSite.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20220117153702_fuel_sources.ts:7](../migrations/20220117153702_fuel_sources.ts#L7) |
| UsedInToFuelSourceToSite.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20220311163726_energy_2.ts:5](../migrations/20220311163726_energy_2.ts#L5) |
| Utilities.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211111202053_utility_table.ts:4](../migrations/20211111202053_utility_table.ts#L4) |
| Utilities.name | string | LegacyUtilityReference.name | Preserve field with source provenance; validate type, length and entity association. | [migrations/20211111202053_utility_table.ts:4](../migrations/20211111202053_utility_table.ts#L4) |
| Utilities.businessId | integer | organisationId | Resolve source Businesses; validate ownership. | [migrations/20211111202053_utility_table.ts:4](../migrations/20211111202053_utility_table.ts#L4) |
| UtilityConsumptions.id | string | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20230617073554_consumption_id.ts:11](../migrations/20230617073554_consumption_id.ts#L11) |
| UtilityConsumptions.date | string | periodStart/periodEnd or effectiveFrom | Validate monthly date and timezone; emissions effective interval requires policy. | [migrations/20211111212202_utility_consumption_table.ts:4](../migrations/20211111212202_utility_consumption_table.ts#L4) |
| UtilityConsumptions.consumption | float | sourceQuantity + normalizedQuantity | Decimal source quantity; apply approved versioned conversion once. | [migrations/20220923204330_consumption_type.ts:4](../migrations/20220923204330_consumption_type.ts#L4) |
| UtilityConsumptions.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211220022447_utility_consumption_2.ts:4](../migrations/20211220022447_utility_consumption_2.ts#L4) |
| UtilityConsumptions.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20220208154757_consumption_emission.ts:4](../migrations/20220208154757_consumption_emission.ts#L4) |
| UtilityConsumptions.totalCost | float | costAmount | Decimal currency amount; resolve tax inclusion; do not infer unit rate without valid quantity. | [migrations/20230628003643_consumption_emission_target_types.ts:4](../migrations/20230628003643_consumption_emission_target_types.ts#L4) |
| UtilityConsumptions.conversionFactor | float | UnitConversionVersion.value + reference | Validate dimensional basis and provenance; snapshot original factor. | [migrations/20230628003643_consumption_emission_target_types.ts:4](../migrations/20230628003643_consumption_emission_target_types.ts#L4) |
| UtilityConsumptions.fuelUnit | string | sourceUnitId | Normalize spelling; L/m3/kWh initial map; no silent unsupported-unit fallback. | [migrations/20221130161903_emission_2.ts:16](../migrations/20221130161903_emission_2.ts#L16) |
| UtilityConsumptions.vat | float | taxRate | Confirm percent vs fraction and gross/net semantics before conversion. | [migrations/20230628003643_consumption_emission_target_types.ts:4](../migrations/20230628003643_consumption_emission_target_types.ts#L4) |
| UtilityConsumptions.created_at | timestamp | created_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230617073554_consumption_id.ts:11](../migrations/20230617073554_consumption_id.ts#L11) |
| UtilityConsumptions.updated_at | timestamp | updated_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230617073554_consumption_id.ts:11](../migrations/20230617073554_consumption_id.ts#L11) |
| UtilityConsumptions.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20240831012717_utility_unique_index.ts:4](../migrations/20240831012717_utility_unique_index.ts#L4) |
| UtilityConsumptions.vatCost | float | taxAmount | Decimal amount; retain null vs zero and original currency. | [migrations/20241120031833_utility_vatCost.ts:4](../migrations/20241120031833_utility_vatCost.ts#L4) |
| UtilityConsumptions.population | float | DriverObservation(population) | Monthly source observation for consumption rows; historical attribute for floors. | [migrations/20250317181454_consumption_population_time.ts:4](../migrations/20250317181454_consumption_population_time.ts#L4) |
| UtilityConsumptions.workingHours | float | DriverObservation(operatingHours) | Preserve period and basis (daily/monthly unresolved); do not mix schedules with observed totals. | [migrations/20250317181454_consumption_population_time.ts:4](../migrations/20250317181454_consumption_population_time.ts#L4) |
| UtilityEmissions.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20211213150659_emissions.ts:4](../migrations/20211213150659_emissions.ts#L4) |
| UtilityEmissions.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20211220015724_utilityEmission_2.ts:4](../migrations/20211220015724_utilityEmission_2.ts#L4) |
| UtilityEmissions.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20220208154757_consumption_emission.ts:9](../migrations/20220208154757_consumption_emission.ts#L9) |
| UtilityEmissions.conversionFactor | float | UnitConversionVersion.value + reference | Validate dimensional basis and provenance; snapshot original factor. | [migrations/20230628003643_consumption_emission_target_types.ts:10](../migrations/20230628003643_consumption_emission_target_types.ts#L10) |
| UtilityEmissions.fuelUnit | string | sourceUnitId | Normalize spelling; L/m3/kWh initial map; no silent unsupported-unit fallback. | [migrations/20221130161903_emission_2.ts:4](../migrations/20221130161903_emission_2.ts#L4) |
| UtilityEmissions.emissionFactor | float | EmissionFactorVersion.value | Require kgCO2e unit basis, fuel/geography/source and effective dates; legacy provenance marked unknown when absent. | [migrations/20230623091553_emissions_factor_type.ts:4](../migrations/20230623091553_emissions_factor_type.ts#L4) |
| UtilityEmissions.date | string | periodStart/periodEnd or effectiveFrom | Validate monthly date and timezone; emissions effective interval requires policy. | [migrations/20221130161903_emission_2.ts:4](../migrations/20221130161903_emission_2.ts#L4) |
| UtilityEmissions.created_at | timestamp | created_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230623223413_emission_monitoring_refactor.ts:11](../migrations/20230623223413_emission_monitoring_refactor.ts#L11) |
| UtilityEmissions.updated_at | timestamp | updated_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230623223413_emission_monitoring_refactor.ts:11](../migrations/20230623223413_emission_monitoring_refactor.ts#L11) |
| UtilityMonitoring.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.energy | float | TargetValue.energy | Keep physical quantity, unit and target type; never mix measured data and desired target. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.carbon | float | TargetValue.carbon | Keep physical quantity, unit and target type; never mix measured data and desired target. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.conversionFactor | float | UnitConversionVersion.value + reference | Validate dimensional basis and provenance; snapshot original factor. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.fuelUnit | string | sourceUnitId | Normalize spelling; L/m3/kWh initial map; no silent unsupported-unit fallback. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.date | string | periodStart/periodEnd or effectiveFrom | Validate monthly date and timezone; emissions effective interval requires policy. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.fuelSourceId | integer | energySourceId | Map catalog fuel by stable identity, validate unit compatibility. | [migrations/20230424183822_utility_monitoring.ts:4](../migrations/20230424183822_utility_monitoring.ts#L4) |
| UtilityMonitoring.created_at | timestamp | created_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230623223413_emission_monitoring_refactor.ts:14](../migrations/20230623223413_emission_monitoring_refactor.ts#L14) |
| UtilityMonitoring.updated_at | timestamp | updated_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230623223413_emission_monitoring_refactor.ts:14](../migrations/20230623223413_emission_monitoring_refactor.ts#L14) |
| UtilityMonitoringToUseInId.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20230424183822_utility_monitoring.ts:23](../migrations/20230424183822_utility_monitoring.ts#L23) |
| UtilityMonitoringToUseInId.monitoringId | integer | targetId | Map UtilityMonitoring parent; preserve end-use association. | [migrations/20230424183822_utility_monitoring.ts:23](../migrations/20230424183822_utility_monitoring.ts#L23) |
| UtilityMonitoringToUseInId.usedInId | integer | endUseId | Map use taxonomy; do not confuse with fuel source or duplicate quantity. | [migrations/20230424183822_utility_monitoring.ts:23](../migrations/20230424183822_utility_monitoring.ts#L23) |
| UtilityMonitoringToUseInId.created_at | timestamp | created_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230424183822_utility_monitoring.ts:23](../migrations/20230424183822_utility_monitoring.ts#L23) |
| UtilityMonitoringToUseInId.updated_at | timestamp | updated_at | Preserve source timestamp when available; record migration time separately in UTC. | [migrations/20230424183822_utility_monitoring.ts:23](../migrations/20230424183822_utility_monitoring.ts#L23) |
| UtilityToDriver.id | increments | UUID + externalLegacyId | Preserve string/int identity in source ledger; never numeric-cast ULIDs. | [migrations/20260612073555_waste_config_sheet.ts:4](../migrations/20260612073555_waste_config_sheet.ts#L4) |
| UtilityToDriver.driver | string | BaselineDriverPolicy.adjustmentType | R → routine; NR → non-routine; invalid value is rejection. | [migrations/20260612073555_waste_config_sheet.ts:4](../migrations/20260612073555_waste_config_sheet.ts#L4) |
| UtilityToDriver.category | string | DriverDefinition.key | Map Heating/HDD, Cooling/CDD, Daylight/daylight, Population, OperatingHours, BuildingSize; last requires model-policy decision. | [migrations/20260612073555_waste_config_sheet.ts:4](../migrations/20260612073555_waste_config_sheet.ts#L4) |
| UtilityToDriver.siteId | integer | siteId + organisationId | Resolve owned site; reject orphan or ownership mismatch. | [migrations/20260612073555_waste_config_sheet.ts:4](../migrations/20260612073555_waste_config_sheet.ts#L4) |

## Historical fields and removed tables

Migrations remove Businesses.siteName, holydayDate, totalArea, totalPopulation, workingHoursStart/End; Sites.fuel/uses and later population/workinghours; UtilityConsumptions.cost/conversionUnit and fullTimeEmployeeHours/buidingExtension/changeBuildingLocation; UtilityEmissions.year/value/consumption; and old use joins UtilityConsumptionsUse/UtilityEmissionsUse. Brands/BrandDays are replaced by BusinessBrands; BusinessService becomes BusinessPatterns; UsedInToFuelSource becomes UsedInToFuelSourceToSite.

If these fields still exist in production or backups, map old cost to source cost, conversionUnit to source unit, dates/working hours to historical schedules, occupant/area to historical drivers, extension/location flags to operational-change evidence, and old emission value/year to a legacy carbon result with known unit/period. Preserve dropped join relationships for reconciliation; do not reapply them on top of newer usedInId and double-count. Schema version determines adapter selection. Empty/incomplete down migrations are not an acceptable production rollback strategy.

The OpenAPI Site schema still exposes population/workinghours although later migrations drop them. Generated contracts still need comparison with the deployed schema even when they include monthly drivers. Use both observed schema and source-specific adapters, not generated TS types as database authority.

## Nested Sequelize models

| Model | All declared data fields | Destination | Transformation / limitation |
| --- | --- | --- | --- |
| UserModel / users | id, email, password, createdAt, updatedAt | User + Membership + identity ledger | Map identity, exclude password, require activation; membership relationship is not established by this model. |
| BusinessModel / businesses | id, email, name, type, natureOfService, siteName, buildingName, country, state, town, startDate, endDate, buildingArea, businessContactName1, businessContactName2, position, phoneNumber, createdAt, updatedAt | Organisation, contacts, optional Site/Space history | name→organisation.name; type/service retain; location text→canonical references; preserve date purpose pending review; buildingArea TEXT JSON needs validated parse; contact names stay separate. Site linkage unresolved. |
| UtilitiesModel | id, name, value, createdAt, updatedAt | Legacy utility/catalog record pending schema confirmation | Model declares table businesses. Verify physical table before extracting; name/value semantics cannot safely be interpreted as monthly consumption. |
| BuildingEnergyModel | id, energyType, fuelSource, billingCurrency, uses, createdAt, updatedAt | EnergySource, end-use and tariff associations | Model declares businesses and returns undefined BusinessModel identifier; not trustworthy as deployed schema. Map strings to catalogs only after verification. |

## UI and HTTP contract mapping

UI Models/Register maps to Organisation/contact/invitation; Models/Login to auth input only; Site to Site and historical attributes; Floor to optional SiteSpace; FuelSource/FuelUse to catalog references; Consumption to ConsumptionRecord; Emission to factor input; M_T to MonitoringTarget; BuildingPattern to OperatingSchedule; Logs/Operation to OperationalEvent and occupant observations; Review to review/checklist evidence; Tarriff to tariff periods. Option is presentation state and is not persisted as a domain model. See the inventory for every declared contract field.

| Legacy HTTP family | Proposed V2 boundary | Mapping rule |
| --- | --- | --- |
| POST /api/auth; POST /api/auth/login; nested signup/login/logout | Auth adapter and onboarding actions | Separate organisation creation from identity; no reusable credential migration. |
| /api/business profile, /sites, /foors | Organisation, membership, sites and optional spaces | /foors is a legacy spelling, not a required new route. |
| /api/business/saveEnergy | Site meter/end-use/tariff commands | Split nested brands/meternumbers/cost into normalized child entities. |
| /api/business/savePattern, /patterns, /logs, /addLog, /setTenants | Drivers, schedules and event APIs | Preserve semantics and period; apply tenant authorization to every child ID. |
| /api/business/setReviews, /setProgrammes | Evidence/checklist commands | Preserve answers without treating them as verified outcomes. |
| /api/site CRUD and conversion units | GET/POST /api/v1/sites and scoped site/meter commands | UUIDs, tenant ownership, Zod boundaries; no legacy unscoped ID endpoints. |
| /api/utility consumption/manual/import routes | POST /api/v1/consumption/bulk and /api/v1/imports | Monthly explicit periods, preview/validation, append vs correction and idempotency. |
| /api/utility emissions/monitoring/fuel/use/tips | Factors, targets, catalogs and opportunity templates | Separate source consumption, factor versions and derived carbon. |
| /api/dashboard and carbonFootprint/portfolio/energyWaste | POST /api/v1/analysis/run and read-model queries | One versioned calculation engine; authorized portfolio filters. |
| /api/dashboard/reports and /getReport | GET /api/v1/reports and generation jobs | Persist report metadata and result references. |
| /api/conversionUnit | Unit/conversion catalog | Explicit source/target units and version policy. |
| Nested /users, /business, /Utilities CRUD | Domain commands above | Reference contracts only; no one-for-one unprotected endpoint port. |

## Workbook contracts and provenance

| Reference | Location and hash | Discovery status |
| --- | --- | --- |
| business_example_v3.xlsx | test/fixtures/business_example_v3.xlsx; SHA-256 1cf0a29d359ebbbed20336a4b579ef22c39e93686192feabada5201191764b6b | Two sheets; Hoja1 A1:P3 (two business rows), Hoja2 A1:I2 (one site row). Credential column has two populated data cells; values intentionally not copied into documentation. |
| Multi Routine Adjustment Plus NRA V2.xlsx | /home/leonardo/Downloads/Multi Routine Adjustment Plus NRA V2.xlsx; SHA-256 427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed | Formula/cache discrepancy CD11; not approved as golden fixture. Original remains unchanged outside repository. |
| Single Routine Adjustment V2.xlsx | Not found in checked repository and Downloads locations | Required before Sprint 4 acceptance. |
| Multi Routine Adjustment V2.xlsx | Not found in checked repository and Downloads locations | Required before Sprint 4 acceptance. |

business_example_v3 header mapping:

- Hoja1: businessName/type/service → organisation; buildingName → legacy building label; contactName/position/phoneNumber/email → contact/invitation; town/postCode/address_1 → organisation address; countryId/stateId → reference mapping; currencyCode → currency policy; subscriptionDate → legacy metadata; password → excluded/rejected.
- Hoja2: name/type/address/postCode/town → Site; population/workinghours → initial historical attributes only after effective-date policy; size → floor area after unit confirmation; businessEmail → source organisation relationship after validated identity mapping.
- The fixture lacks the newer site code and country columns expected by the positional importer. Require user mapping/explicit defaults rather than shifting columns or inventing data. Multi-business rows require an explicit import grouping policy.
- Do not copy this workbook into a new public fixture directory as-is. Create an approved sanitized test fixture when implementation is authorized; retain the original hash as provenance.

The five-sheet utility parser adds consumption, emissions, targets, setpoints and drivers. The named-sheet parser uses Consumption/Emissions/Targets. Both must map to the same validated domain pipeline. Preserve raw quantity/unit, source conversion factor, cost/VAT and end-use before normalization. Occupancy/hours and driver classifications must not be lost when a sheet variant omits them.

## Migration execution and cutover outline

Sprint 8 implementation will use a read-only production inventory, source-specific adapters, mapping ledger, deterministic dry-run report and reconciliation totals. Record source row counts, accepted/rejected counts, missing relations and per-site/month/fuel control totals. Dry runs must not mutate source databases.

A final cutover runbook must name responsible owners, acceptable reconciliation tolerances, backup/restore point, write-freeze window, final delta import, validation queries, go/no-go checks and rollback trigger. Preserve legacy read-only access where practical. Rollback must account for writes made in V2 after cutover; never destroy the old database or rely on reversing incomplete historical down migrations.

Outstanding evidence: actual production schema/migration history, sanitized data sample, timezone/currency/unit meanings, orphan counts and business-to-user membership policy. This source-derived map supports review; it is not a claim that production migration has been tested.

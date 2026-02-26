# Audit implementace požadovaných funkcí (9 bodů)

Datum: 2026-02-25

## Shrnutí

- **Plně implementováno:** 1 bod
- **Částečně implementováno:** 2 body
- **Neimplementováno:** 6 bodů

## Detailní vyhodnocení

1. **Akční fronta (Kanban) + stav/poznámka/priorita/datum poslední akce**
   - **Stav:** ČÁSTEČNĚ.
   - V UI je stavový pipeline (`Nové`, `Prověřit`, `Kontaktováno`, `Vyjednávání`, `Uzavřeno`) a pole pro poznámku.
   - Chybí priorita a datum poslední akce.
   - Metadata jsou uložena jen v `localStorage`, ne v backendu/DB.

2. **One-click šablony zpráv (Bazoš/SMS/e-mail)**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - V UI nejsou tlačítka pro kopírování šablon zpráv prodávajícímu/kupujícímu.

3. **Skóre „reálné příležitosti“ (vážené, 0–100)**
   - **Stav:** ČÁSTEČNĚ.
   - Backend počítá `opportunityScore` i `realOpportunityScore` (včetně profit/margin/similarity/freshness) a řadí podle `realOpportunityScore`.
   - Chybí explicitní složky: vzdálenost/lokalita a důvěryhodnost ceny (outlier detection).

4. **Alerty na nové TOP shody (Telegram/Email/Discord webhook)**
   - **Stav:** ČÁSTEČNĚ.
   - Existuje endpoint `/alerts/notify` s odesláním top 5 položek na Telegram a obecný email webhook.
   - Chybí Discord webhook.
   - Chybí automatické filtrování „jen pokud zisk > X a score > Y“ přímo v endpointu.

5. **Blacklist / whitelist pravidla**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - Nalezené filtrování je jen technické (značka, storage, cenové ratio), bez uživatelsky definovatelných blacklist/whitelist pravidel.

6. **Dedup & „už řešeno“ paměť mezi běhy**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - Deduplikace existuje pouze v rámci jednoho běhu porovnání (`seenMatches` set).
   - Chybí perzistentní flag „nebrat/řešeno“ per dvojice `offer_id + demand_id` a filtr „skrýt vyřešené“.

7. **Export do CSV/Google Sheets + denní report**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - Není nalezen export CSV ani integrace do Google Sheets/denní report.

8. **Kalendář/Reminder pro follow-up**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - Není nalezena funkcionalita připomínek ani workflow „neodpověděl“.

9. **Klikací checklist due diligence**
   - **Stav:** NEIMPLEMENTOVÁNO.
   - Není nalezen checklist (IMEI, baterie, displej, příslušenství, doklad/záruka).

## Poznámka

Během auditu byl identifikován možný problém v `ResultsDisplay.tsx` (chybějící definice `metaByMatch` a `updateMatchMeta`), který může způsobit build/runtime chybu, ale tento dokument řeší pouze stav implementace požadovaných funkcí.

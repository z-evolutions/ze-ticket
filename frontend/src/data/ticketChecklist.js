export const CHECKLIST_PHASES = [
  {
    id: 'eingang',
    title: 'Ticketeingang & Erstbewertung',
    steps: [
      { id: 'e1', text: 'Ticket im System erfassen', hint: 'Eingangszeit, Kanal und Ticketnummer dokumentieren' },
      { id: 'e2', text: 'Priorität und Kategorie festlegen', hint: 'Hardware / Software / Netzwerk / Zugang — Priorität nach Dringlichkeit' },
      { id: 'e3', text: 'Erstquittierung an Melder senden', hint: 'Ticket erhalten bestätigen, Bearbeitungszeit nennen' },
      { id: 'e4', text: 'Ticket dem zuständigen Techniker zuweisen', hint: 'Ggf. nach Fachgebiet oder Verfügbarkeit eskalieren' },
    ]
  },
  {
    id: 'info',
    title: 'Informationserhebung',
    steps: [
      { id: 'i1', text: 'Fehlerbeschreibung vollständig prüfen', hint: 'Was passiert genau? Seit wann? Fehlermeldung vorhanden?' },
      { id: 'i2', text: 'Betroffenes System / Gerät identifizieren', hint: 'Hostname, IP-Adresse, Betriebssystem, Hardware-Typ' },
      { id: 'i3', text: 'Benutzerumgebung erfassen', hint: 'Abteilung, Standort, Anzahl betroffener Personen' },
      { id: 'i4', text: 'Reproduzierbarkeit abklären', hint: 'Tritt der Fehler immer auf? Unter welchen Bedingungen?' },
      { id: 'i5', text: 'Fehlende Informationen beim Melder einholen', hint: 'Rückfrage per Ticket-Kommentar oder Telefon' },
    ]
  },
  {
    id: 'diagnose',
    title: 'Diagnose & Analyse',
    steps: [
      { id: 'd1', text: 'Bekannte Lösungen / Wissensdatenbank prüfen', hint: 'Tickethistorie, interne KB, Hersteller-Dokumentation' },
      { id: 'd2', text: 'Fehler remote oder vor Ort analysieren', hint: 'Remotezugriff (RDP, TeamViewer) oder Vor-Ort-Termin vereinbaren' },
      { id: 'd3', text: 'Log-Dateien und Ereignisanzeige auswerten', hint: 'Windows Event Log, Syslog, Applikationslogs' },
      { id: 'd4', text: 'Netzwerk und Erreichbarkeit prüfen', hint: 'Ping, Traceroute, DNS-Auflösung, Firewall-Regeln' },
      { id: 'd5', text: 'Ursache eingrenzen und dokumentieren', hint: 'Verdacht / Diagnose im Ticket als Kommentar festhalten' },
    ]
  },
  {
    id: 'behebung',
    title: 'Fehlerbehebung',
    steps: [
      { id: 'b1', text: 'Lösungsansatz festlegen und ggf. abstimmen', hint: 'Bei kritischen Änderungen: Change-Prozess einhalten' },
      { id: 'b2', text: 'Massnahme durchfuehren', hint: 'Patch, Konfigurationsaenderung, Neustart, Treiber-Update, Passwort-Reset usw.' },
      { id: 'b3', text: 'Alle Schritte im Ticket protokollieren', hint: 'Was wurde wann gemacht? Wer hat es gemacht?' },
      { id: 'b4', text: 'Workaround dokumentieren (falls keine Dauerloesung)', hint: 'Temporaere Loesung klar kennzeichnen — Folgetermin anlegen' },
    ]
  },
  {
    id: 'verifikation',
    title: 'Verifikation & Ruecksprache',
    steps: [
      { id: 'v1', text: 'Fehlerfreiheit auf betroffenen Systemen testen', hint: 'Reproduktionsschritte aus Phase 3 erneut durchfuehren' },
      { id: 'v2', text: 'Melder zur Bestaetigung kontaktieren', hint: 'Benutzer bestaetigt: Problem ist behoben?' },
      { id: 'v3', text: 'Wartezeit bei Bedarf einhalten', hint: 'Bei zeitabhaengigen Fehlern: System beobachten lassen' },
    ]
  },
  {
    id: 'abschluss',
    title: 'Abschluss & Dokumentation',
    steps: [
      { id: 'a1', text: 'Loesung vollstaendig im Ticket beschreiben', hint: 'Ursache, Massnahme, Ergebnis — fuer Nachvollziehbarkeit' },
      { id: 'a2', text: 'Ticket-Status auf Geloest setzen', hint: 'Datum und Uhrzeit der Behebung festhalten' },
      { id: 'a3', text: 'Melder abschliessend informieren', hint: 'Loesungszusammenfassung und Praeventionshinweise mitteilen' },
      { id: 'a4', text: 'Ticket nach Bestaedigungsfrist schliessen', hint: 'Typisch: 3-5 Werktage nach Rueckmeldung' },
      { id: 'a5', text: 'Wissensdatenbank aktualisieren', hint: 'Neue oder unbekannte Fehler als Artikel in der KB anlegen' },
    ]
  },
]

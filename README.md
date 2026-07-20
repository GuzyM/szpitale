# HospitalAPP – moduł Gruper JGP

Mobilna aplikacja PWA instalowalna na ekranie początkowym iPhone’a. Wersja 0.4 obejmuje 702 grupy JGP z oficjalnych załączników 1a i 9 do zarządzenia NFZ 46/2026/DSOZ z 30.04.2026 r. oraz pierwszą warstwę publicznych danych umownych z API NFZ.

Zakres pierwszej warstwy:

- wyszukiwanie po kodzie grupy, kodzie produktu, procedurze ICD-9, rozpoznaniu ICD-10 i nazwie,
- wszystkie wartości punktowe opublikowane w katalogu 1a,
- warunki grupowania oraz listy procedur i rozpoznań z charakterystyki JGP,
- zakresy świadczeń, w których katalog 1a dopuszcza rozliczenie grupy,
- zweryfikowany kod zakresu, produkt jednostkowy, okres i średnią cenę punktu z API Umowy NFZ dla aktualnego profilu,
- wyraźne rozdzielenie danych źródłowych NFZ od ustawień i obliczeń użytkownika,
- liczba dni finansowanych grupą i osobodzień ponad ryczałt,
- kalkulacja dla ceny punktu i ręcznie wpisanego współczynnika przypisanego wyłącznie do wybranej grupy,
- działanie offline po pierwszym uruchomieniu,
- zapisywanie ustawień wyłącznie w pamięci urządzenia.

Źródła:

- https://baw.nfz.gov.pl/NFZ/document/43868/Zarzadzenie-46_2026_DSOZ
- https://api.nfz.gov.pl/

## Uruchomienie lokalne

Uruchom dowolny serwer statyczny w katalogu projektu, np. `python3 -m http.server 8080`, a następnie otwórz `http://localhost:8080`.

Service worker i instalacja PWA wymagają hostingu przez HTTPS (wyjątkiem jest `localhost`).

## Aktualizacja danych

Po pobraniu nowych oficjalnych załączników 1a i 9 uruchom:

```bash
python3 scripts/import_nfz_reference.py /ścieżka/do/Zalacznik1a.xlsx /ścieżka/do/Zalacznik9.xlsx
```

Importer sprawdza komplet 702 grup i tworzy podzielone pliki `data/jgp-data-*.js` oraz `data/jgp-characteristics-*.js`, używane także w trybie offline.

Publiczny profil zakresu umowy można odświeżyć poleceniem:

```bash
python3 scripts/sync_nfz_contract.py
```

Skrypt korzysta z API Umowy NFZ v1.2 i nie zapisuje w aplikacji nazwy, adresu, NIP ani REGON świadczeniodawcy. Parametry innego profilu można podać przez `--year`, `--branch`, `--provider-code`, `--product-code` i `--agreement-code`.

## Testy

```bash
npm test
```

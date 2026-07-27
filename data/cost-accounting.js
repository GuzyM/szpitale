"use strict";

window.HOSPITALAPP_COST_ACCOUNTING = {
  meta: {
    title: "Standard rachunku kosztów u świadczeniodawców",
    act: "Rozporządzenie Ministra Zdrowia z 26 października 2020 r.",
    journal: "Dz.U. 2020 poz. 2045",
    effectiveFrom: "2021-01-01",
    checkedAt: "2026-07-24",
    status: "obowiązujący",
    sourceUrl: "https://eli.gov.pl/eli/DU/2020/2045/ogl",
    note: "Treści w HospitalAPP są praktycznym opracowaniem. Wiążąca jest treść aktu prawnego i oficjalne wyjaśnienia AOTMiT."
  },
  regulationEntries: [
    {
      id: "scope",
      reference: "§ 1",
      title: "Zakres standardu rachunku kosztów",
      topic: "Podstawa prawna",
      text: "Rozporządzenie określa zalecenia standardu rachunku kosztów dla świadczeniodawców wskazanych w art. 31lc ust. 6 ustawy o świadczeniach opieki zdrowotnej finansowanych ze środków publicznych.",
      keywords: "obowiązek świadczeniodawca NFZ zakres podmiotowy rozporządzenie"
    },
    {
      id: "definitions",
      reference: "§ 2",
      title: "Najważniejsze definicje",
      topic: "Definicje",
      text: "Przepis definiuje m.in. działalność podstawową, pomocniczą i komercyjną, koszty bezpośrednie i pośrednie, klucz podziałowy, rozdzielnik kosztów wspólnych, OPK, OPK proceduralny, procedurę medyczną oraz koszty zarządu.",
      keywords: "OPK definicja koszt bezpośredni pośredni klucz rozdzielnik procedura zarząd"
    },
    {
      id: "opk",
      reference: "§ 3",
      title: "Wyodrębnianie i kodowanie OPK",
      topic: "OPK",
      text: "Świadczeniodawca wyodrębnia OPK działalności podstawowej, pomocniczej i zarządu. Szczegółowy wykaz dostosowuje do swojej struktury, a przy przekazywaniu danych przypisuje kod funkcji i właściwy kod specjalności.",
      keywords: "OPK konto 5 kod funkcji kod resortowy specjalność struktura"
    },
    {
      id: "allocation-stages",
      reference: "§ 4",
      title: "Trzy etapy kalkulacji kosztu OPK",
      topic: "Alokacja",
      text: "Etap I obejmuje ewidencję kosztów bezpośrednich OPK, etap II alokację kosztów działalności pomocniczej, a etap III alokację kosztów działalności podstawowej, w tym OPK proceduralnych.",
      keywords: "etap alokacja koszt wytworzenia pomocnicza proceduralna"
    },
    {
      id: "direct-costs",
      reference: "§ 5",
      title: "Ewidencja kosztów bezpośrednich i zespół 4",
      topic: "Ewidencja",
      text: "Ewidencja obejmuje wszystkie koszty według kryterium rodzajowego. Koszty przypisuje się do OPK związanych z ich powstaniem, a koszty osobowe rozdziela proporcjonalnie do pracy wykonywanej na rzecz poszczególnych OPK.",
      keywords: "zespół 4 koszty rodzajowe wynagrodzenia personel ewidencja zużycie"
    },
    {
      id: "common-costs",
      reference: "§ 5 ust. 6–9",
      title: "Rozdzielniki kosztów wspólnych",
      topic: "Klucze i rozdzielniki",
      text: "Koszty, których nie można jednoznacznie przypisać na podstawie dokumentów źródłowych, dzieli się standardowymi rozdzielnikami. Własny rozdzielnik jest dopuszczalny, jeżeli zapewnia dokładniejszą alokację i jest wykazywany przy przekazaniu danych.",
      keywords: "rozdzielnik kosztów wspólnych własny dokładniejszy dokumentacja"
    },
    {
      id: "auxiliary",
      reference: "§ 6",
      title: "Rozliczanie działalności pomocniczej",
      topic: "Działalność pomocnicza",
      text: "Wszystkie koszty OPK pomocniczego są alokowane na odbiorców jego usług. Stawka jednostkowa wynika z podzielenia całkowitych kosztów OPK przez liczbę jednostek wybranego klucza podziałowego.",
      keywords: "pomocnicza stawka jednostkowa klucz kuchnia pralnia apteka transport"
    },
    {
      id: "procedural",
      reference: "§ 7",
      title: "OPK proceduralne i wycena procedur",
      topic: "Procedury",
      text: "Koszty OPK proceduralnego obejmują koszty bezpośrednie i pośrednie. Procedury wycenia się według rzeczywistych zasobów, a gdy nie jest to możliwe — według typowo zużywanych zasobów materiałowych i osobowych.",
      keywords: "procedura medyczna OPK 507 rzeczywiste zasoby normatyw wycena"
    },
    {
      id: "procedure-register",
      reference: "§ 7 ust. 6–13",
      title: "Wykaz, ewidencja i koszt jednostkowy procedur",
      topic: "Procedury",
      text: "Każdy OPK proceduralny powinien posiadać pełny wykaz wykonywanych procedur i ilościową ewidencję wykonań. Koszt jednostkowy procedury jest sumą jej kosztu bezpośredniego i pośredniego.",
      keywords: "ICD-9 kod własny liczba wykonań koszt jednostkowy wykaz procedur"
    },
    {
      id: "management",
      reference: "§ 8",
      title: "Koszty zarządu",
      topic: "Zarząd",
      text: "Na OPK zarządu gromadzi się koszty komórek zarządzających podmiotem jako całością, m.in. kierownictwa, finansów, controllingu, kadr, prawa i zakupów. Część kosztów ogólnych, w tym IT, mediów czy sprzątania, podlega odrębnej alokacji i nie stanowi automatycznie kosztów zarządu.",
      keywords: "zarząd administracja controlling finanse kadry IT informatyka media sprzątanie"
    },
    {
      id: "cost-of-sales",
      reference: "§ 9",
      title: "Koszt własny sprzedaży OPK",
      topic: "Wynik OPK",
      text: "Koszt własny sprzedaży OPK tworzy koszt wytworzenia działalności podstawowej powiększony o przypadające na ten OPK koszty zarządu.",
      keywords: "koszt własny sprzedaży wynik OPK koszt wytworzenia zarząd"
    },
    {
      id: "effective-date",
      reference: "§ 10",
      title: "Wejście w życie",
      topic: "Podstawa prawna",
      text: "Rozporządzenie weszło w życie 1 stycznia 2021 r. i w metryce ELI ma status aktu obowiązującego.",
      keywords: "data wejścia życie obowiązuje 2021"
    },
    {
      id: "annex-1",
      reference: "Załącznik nr 1",
      title: "Kody funkcji ośrodków powstawania kosztów",
      topic: "Załączniki",
      text: "Załącznik porządkuje kody funkcji dla OPK działalności podstawowej, pomocniczej, komercyjnej i zarządu.",
      keywords: "kod funkcji 500 501 502 503 504 505 506 507 508 530 540 550"
    },
    {
      id: "annex-2",
      reference: "Załącznik nr 2",
      title: "Zasady wyodrębniania OPK",
      topic: "Załączniki",
      text: "Zasady pomagają ustalić jednorodne kosztowo OPK, rozdzielić działalność proceduralną od nieproceduralnej oraz odwzorować organizację i sposób realizacji świadczeń.",
      keywords: "wyodrębnianie OPK oddział blok sala poradnia jednorodność"
    },
    {
      id: "annex-3",
      reference: "Załącznik nr 3",
      title: "Kody funkcji i specjalności komórek",
      topic: "Załączniki",
      text: "Załącznik wskazuje sposób przypisywania kodów charakteryzujących funkcję i specjalność komórki organizacyjnej do poszczególnych rodzajów działalności.",
      keywords: "kod specjalności komórka organizacyjna resortowy funkcja"
    },
    {
      id: "annex-4",
      reference: "Załącznik nr 4",
      title: "Wzór mapowania kont zespołu 5",
      topic: "Załączniki",
      text: "Wzór służy do powiązania własnych kont OPK w układzie podmiotowo-funkcjonalnym z kodami funkcji i specjalności wymaganymi przy przekazywaniu danych.",
      keywords: "mapowanie konta 5 zespół 5 kod syntetyczny AOTMiT"
    },
    {
      id: "annex-5",
      reference: "Załącznik nr 5",
      title: "Ewidencja kosztów rodzajowych — zespół 4",
      topic: "Załączniki",
      text: "Załącznik opisuje standardową strukturę ewidencji kosztów według rodzaju, w tym materiały, leki, wynagrodzenia, usługi obce i pozostałe koszty.",
      keywords: "zespół 4 plan kont analityka leki materiały wynagrodzenia usługi"
    },
    {
      id: "annex-6",
      reference: "Załącznik nr 6",
      title: "Standardowe rozdzielniki kosztów wspólnych",
      topic: "Załączniki",
      text: "Załącznik przypisuje typowym kosztom wspólnym zalecane jednostki podziału, np. powierzchnię, zużycie, liczbę osób albo inną miarę odzwierciedlającą związek kosztu z odbiorcą.",
      keywords: "rozdzielnik wspólny powierzchnia zużycie etaty osoby"
    },
    {
      id: "annex-7",
      reference: "Załącznik nr 7",
      title: "Klucze dla działalności pomocniczej",
      topic: "Załączniki",
      text: "Załącznik wskazuje standardowe klucze dla OPK pomocniczych, np. apteki, sterylizacji, pralni, kuchni, transportu i zaplecza technicznego.",
      keywords: "apteka sterylizacja pralnia kuchnia transport klucz pomocniczy"
    },
    {
      id: "annex-8",
      reference: "Załącznik nr 8",
      title: "Klucze dla działalności podstawowej i proceduralnej",
      topic: "Załączniki",
      text: "Załącznik określa klucze służące przenoszeniu kosztów działalności podstawowej i OPK proceduralnych na jednostki korzystające z ich świadczeń.",
      keywords: "klucz podstawowa proceduralna zlecenie oddział poradnia"
    },
    {
      id: "annex-9",
      reference: "Załącznik nr 9",
      title: "Sposoby wyceny procedur medycznych",
      topic: "Załączniki",
      text: "Załącznik opisuje trzy podejścia: rzeczywiste koszty zużytych zasobów, typowe zasoby z rozliczeniem kosztów pośrednich czasem procedury oraz typowe zasoby z jednostką kalkulacyjną.",
      keywords: "wycena procedury rzeczywista normatyw czas jednostka kalkulacyjna personel"
    }
  ],
  faq: [
    {
      id: "faq-01",
      category: "Obowiązek",
      question: "Kogo dotyczy obowiązek stosowania standardu rachunku kosztów?",
      answer: "Co do zasady dotyczy świadczeniodawców posiadających umowę z NFZ. Ustawa przewiduje wyłączenia, m.in. dla podmiotów udzielających wyłącznie POZ, nieprowadzących ksiąg rachunkowych oraz realizujących wyłącznie zaopatrzenie w wyroby medyczne.",
      reference: "art. 31lc ust. 6 i 8 ustawy; FAQ AOTMiT",
      keywords: "kto musi obowiązek NFZ POZ księgi rachunkowe"
    },
    {
      id: "faq-02",
      category: "Wdrożenie",
      question: "Od czego praktycznie zacząć wdrożenie SRK?",
      answer: "Od uporządkowania listy OPK i mapowania kont zespołu 5, planu kont zespołu 4, rozdzielników kosztów wspólnych i kluczy podziałowych. Następnie można etapowo rozwijać wykazy oraz wycenę procedur.",
      reference: "§ 3–7; FAQ AOTMiT",
      keywords: "jak zacząć wdrożenie lista OPK plan kont"
    },
    {
      id: "faq-03",
      category: "Systemy IT",
      question: "Czy trzeba kupić konkretny program wskazany przez AOTMiT?",
      answer: "Nie. Przepisy nie narzucają jednego systemu informatycznego ani konkretnego modułu kalkulacyjnego. Używane rozwiązanie powinno jednak umożliwić prowadzenie wymaganej ewidencji, alokacji i raportowania.",
      reference: "FAQ AOTMiT",
      keywords: "program system informatyczny aplikacja moduł licencja"
    },
    {
      id: "faq-04",
      category: "OPK",
      question: "Czy trzeba zmieniać istniejące symbole kont zespołu 5?",
      answer: "Nie ma takiego bezwzględnego obowiązku. Szpital może zachować własną numerację, ale musi umieć przypisać każdemu OPK kod funkcji i właściwy kod specjalności w układzie wymaganym przy przekazywaniu danych.",
      reference: "§ 3 ust. 4–5; załącznik nr 4; FAQ AOTMiT",
      keywords: "konta 5 symbole numeracja kod syntetyczny mapowanie"
    },
    {
      id: "faq-05",
      category: "OPK",
      question: "Czy ta sama działalność w różnych lokalizacjach powinna mieć osobne OPK?",
      answer: "Jeżeli działalność jest prowadzona w odrębnych lokalizacjach, AOTMiT wskazuje wyodrębnienie osobnych OPK, tak aby koszty i zasoby każdej lokalizacji były możliwe do rozliczenia.",
      reference: "załącznik nr 2; FAQ AOTMiT",
      keywords: "lokalizacja wiele budynków osobne OPK"
    },
    {
      id: "faq-06",
      category: "OPK",
      question: "Czy oddział wieloprofilowy zawsze trzeba dzielić na kilka OPK?",
      answer: "Nie zawsze. Dla wieloprofilowego OPK nieproceduralnego można przypisać kilka kodów specjalności. Rozdzielenie może być zasadne zarządczo, gdy działalności istotnie różnią się sposobem powstawania kosztów.",
      reference: "załącznik nr 2–3; FAQ AOTMiT",
      keywords: "oddział wieloprofilowy pododdział kilka kodów"
    },
    {
      id: "faq-07",
      category: "OPK",
      question: "Jak podejść do Centralnego Bloku Operacyjnego?",
      answer: "Część proceduralna powinna być oddzielona od oddziałów i oznaczona kodem funkcji 507. W dużym CBO zasadne jest wyodrębnienie OPK według trwałego kryterium wykorzystania sal, np. specjalności, wyposażenia lub stałego odbiorcy świadczeń.",
      reference: "załącznik nr 2–3; FAQ AOTMiT",
      keywords: "CBO blok operacyjny sala 507 oddział zabiegowy"
    },
    {
      id: "faq-08",
      category: "OPK",
      question: "Czy program lekowy wymaga osobnego OPK?",
      answer: "Sam program lekowy nie wymusza utworzenia osobnego OPK. Koszty leków można wyodrębniać na odpowiednim poziomie analityki kont materiałowych zgodnie z potrzebami zarządczymi podmiotu.",
      reference: "załącznik nr 5; FAQ AOTMiT",
      keywords: "program lekowy chemioterapia osobne OPK leki"
    },
    {
      id: "faq-09",
      category: "Klucze",
      question: "Jak rozliczać koszty sprzątania i prania?",
      answer: "Dla sprzątania właściwym punktem wyjścia jest powierzchnia z uwzględnieniem rodzaju pomieszczeń. Dla prania AOTMiT wskazuje liczbę kilogramów albo liczbę sztuk, jeżeli bielizna jest oznakowana.",
      reference: "załącznik nr 6–7; FAQ AOTMiT",
      keywords: "sprzątanie pranie powierzchnia kilogram bielizna"
    },
    {
      id: "faq-10",
      category: "Klucze",
      question: "Czy aptekę magazynową i działalność recepturową trzeba rozdzielić?",
      answer: "Takie działalności mają odmienne nośniki kosztów. AOTMiT wskazuje osobne OPK: magazynowe rozliczane liczbą pozycji dokumentów rozchodu oraz farmaceutyczne, np. żywienie pozajelitowe lub leki cytotoksyczne, rozliczane liczbą zleceń.",
      reference: "załącznik nr 7; FAQ AOTMiT",
      keywords: "apteka magazynowa produkcyjna cytostatyki żywienie pozajelitowe"
    },
    {
      id: "faq-11",
      category: "Klucze",
      question: "Czy można zastosować własny rozdzielnik albo klucz podziałowy?",
      answer: "Tak, jeżeli lepiej odwzorowuje zależność przyczynowo-skutkową i prowadzi do dokładniejszej alokacji. Własne rozwiązanie powinno być opisane, stosowane konsekwentnie i wykazane przy przekazywaniu danych do Agencji.",
      reference: "§ 5 ust. 7–9; § 6 ust. 5–7",
      keywords: "własny klucz rozdzielnik dokładność uzasadnienie"
    },
    {
      id: "faq-12",
      category: "Koszty osobowe",
      question: "Jak rozdzielać wynagrodzenie osoby pracującej dla kilku OPK?",
      answer: "Koszt osobowy należy przypisać proporcjonalnie do pracy wykonywanej na rzecz poszczególnych OPK. Podstawą powinny być wiarygodne dane o zaangażowaniu, a przyjęty sposób musi być możliwy do objaśnienia i powtarzalny.",
      reference: "§ 5 ust. 5",
      keywords: "wynagrodzenie kilka OPK czas pracy etat personel"
    },
    {
      id: "faq-13",
      category: "Procedury",
      question: "Jak rozliczyć konsultacje lekarza dla innych oddziałów?",
      answer: "Konsultację można traktować jako procedurę medyczną. Po ustaleniu jednostkowego kosztu obciąża się korzystające OPK iloczynem liczby konsultacji i kosztu jednostkowego.",
      reference: "§ 7; FAQ AOTMiT",
      keywords: "konsultacja lekarz inny oddział procedura koszt"
    },
    {
      id: "faq-14",
      category: "Procedury",
      question: "Jak ustalić koszt personelu w procedurze medycznej?",
      answer: "Należy uwzględnić czas pracy personelu zaangażowanego w przygotowanie, wykonanie i zakończenie procedury oraz stawkę wynagrodzenia powiększoną o pochodne. Czas może być rzeczywisty albo przeciętny, zależnie od przyjętej metody.",
      reference: "§ 7 ust. 10; załącznik nr 9",
      keywords: "koszt personelu czas procedury stawka godzinowa pochodne"
    },
    {
      id: "faq-15",
      category: "Procedury",
      question: "Co zrobić, gdy w jednej procedurze uczestniczą dwie pielęgniarki?",
      answer: "Wycena powinna objąć łączny czas zaangażowania wszystkich pracowników. Liczbę osób można wskazać w opisie nakładu pracy albo przemnożyć czas właściwej grupy personelu.",
      reference: "załącznik nr 9; FAQ AOTMiT",
      keywords: "dwie pielęgniarki liczba osób suma czasu"
    },
    {
      id: "faq-16",
      category: "Procedury",
      question: "Czy trzeba wycenić wszystkie procedury, czy tylko najbardziej kosztochłonne?",
      answer: "Wykaz procedur w OPK proceduralnym powinien wyczerpująco odzwierciedlać jego działalność. Rozporządzenie nie ogranicza obowiązku wyłącznie do procedur uznanych przez szpital za kosztochłonne.",
      reference: "§ 7 ust. 6–7; FAQ AOTMiT",
      keywords: "wszystkie procedury kosztochłonne pełny wykaz"
    },
    {
      id: "faq-17",
      category: "Procedury",
      question: "Jakie są dopuszczalne metody wyceny procedur medycznych?",
      answer: "Można oprzeć wycenę na rzeczywistych kosztach zużytych zasobów albo na kosztach typowo zużywanych zasobów. W drugim wariancie koszty pośrednie rozlicza się czasem trwania procedury lub jednostką kalkulacyjną.",
      reference: "§ 7 ust. 3–5; załącznik nr 9",
      keywords: "trzy metody wyceny rzeczywista normatyw czas jednostka kalkulacyjna"
    },
    {
      id: "faq-18",
      category: "Procedury",
      question: "Jakie składniki kosztu należy ująć w wycenie procedury?",
      answer: "W szczególności koszty osobowe oraz bezpośrednio zużyte wyroby medyczne, materiały, leki i środki spożywcze specjalnego przeznaczenia. Do kosztu jednostkowego dochodzi także właściwie ustalony koszt pośredni.",
      reference: "§ 7; załącznik nr 9; FAQ AOTMiT",
      keywords: "materiały leki wyroby medyczne personel koszt pośredni"
    },
    {
      id: "faq-19",
      category: "Procedury",
      question: "Jak wyceniać procedury złożone wykonywane podczas jednego zabiegu?",
      answer: "Jeżeli kilka kodów ICD-9 tworzy jedno powtarzalne wykonanie, którego koszt nie jest prostą sumą elementów, można utworzyć kod własny procedury złożonej, ująć ją w wykazie OPK i wycenić wybraną metodą.",
      reference: "§ 7 ust. 6 i 8; FAQ AOTMiT",
      keywords: "procedura złożona łączona kilka ICD-9 kod własny"
    },
    {
      id: "faq-20",
      category: "Zarząd",
      question: "Czy koszty działu IT są kosztami zarządu?",
      answer: "Nie automatycznie. Rozporządzenie wprost wyłącza dział informatyki z katalogu kosztów zarządu. Jego koszty powinny być rozliczone na korzystające OPK według właściwego rozdzielnika odzwierciedlającego korzystanie z usług IT.",
      reference: "§ 8 ust. 3–4",
      keywords: "IT informatyka koszty zarządu administracja rozliczenie"
    }
  ],
  resources: [
    {
      title: "Pełna treść rozporządzenia",
      type: "Akt prawny",
      description: "Tekst, metryka i dziewięć załączników w systemie ELI.",
      url: "https://eli.gov.pl/eli/DU/2020/2045/ogl"
    },
    {
      title: "FAQ Standardu Rachunku Kosztów",
      type: "AOTMiT",
      description: "Oficjalne odpowiedzi Agencji na praktyczne pytania świadczeniodawców.",
      url: "https://www.aotm.gov.pl/standard-rachunku-kosztow/wsparcie-aotmit-w-srk/faq/"
    },
    {
      title: "Prezentacje i webinaria SRK",
      type: "AOTMiT",
      description: "Nagrania, prezentacje oraz przykłady wyceny procedur dla różnych rodzajów działalności.",
      url: "https://www.aotm.gov.pl/standard-rachunku-kosztow/wsparcie-aotmit-w-srk/prezentacje-webinaria/"
    },
    {
      title: "Szablony dokumentów i instruktaże",
      type: "AOTMiT",
      description: "Materiały pomocnicze do organizacji wdrożenia i prowadzenia SRK.",
      url: "https://www.aotm.gov.pl/standard-rachunku-kosztow/wsparcie-aotmit-w-srk/szablony-dokumentow/"
    },
    {
      title: "ABC #SRK — nowy cykl od września 2026",
      type: "Webinary 2026",
      description: "Zapowiedź praktycznych spotkań co dwa tygodnie. Harmonogram ma zostać opublikowany przez AOTMiT.",
      url: "https://www.aotm.gov.pl/aktualnosci/najnowsze/nowy-cykl-webinarow-aotmit-dotyczacych-standardu-rachunku-kosztow/"
    }
  ]
};

window.HOSPITALAPP_PAYROLL = {
  meta: {
    title: "Skutek zmiany najniższego wynagrodzenia zasadniczego",
    effectiveDate: "2026-07-01",
    previousBase: 8181.72,
    currentBase: 8903.56,
    defaultEmployerOncost: 20.48,
    checkedAt: "2026-07-24",
    actUrl: "https://eli.gov.pl/eli/DU/2022/2139/ogl",
    previousBaseUrl: "https://stat.gov.pl/sygnalne/komunikaty-i-obwieszczenia/lista-komunikatow-i-obwieszczen/komunikat-w-sprawie-przecietnego-wynagrodzenia-w-gospodarce-narodowej-w-2024-r-%2C273%2C12.html",
    currentBaseUrl: "https://stat.gov.pl/sygnalne/komunikaty-i-obwieszczenia/lista-komunikatow-i-obwieszczen/komunikat-w-sprawie-przecietnego-wynagrodzenia-w-gospodarce-narodowej-w-2025-r-%2C273%2C13.html"
  },
  groups: [
    { id: "1", coefficient: 1.45, shortName: "Lekarz ze specjalizacją", name: "Lekarz albo lekarz dentysta ze specjalizacją" },
    { id: "2", coefficient: 1.29, shortName: "Magister ze specjalizacją", name: "Farmaceuta, fizjoterapeuta, diagnosta laboratoryjny, psycholog kliniczny lub inny zawód medyczny z wymaganym magistrem i specjalizacją; pielęgniarka lub położna z wymaganym magistrem i specjalizacją" },
    { id: "3", coefficient: 1.19, shortName: "Lekarz bez specjalizacji", name: "Lekarz albo lekarz dentysta bez specjalizacji" },
    { id: "4", coefficient: 0.95, shortName: "Stażysta", name: "Lekarz albo lekarz dentysta odbywający staż podyplomowy" },
    { id: "5", coefficient: 1.02, shortName: "Magister / pielęgniarka ze specjalizacją", name: "Zawód medyczny z wymaganym magistrem; pielęgniarka lub położna z wymaganym wykształceniem wyższym I stopnia i specjalizacją albo ze średnim wykształceniem i specjalizacją" },
    { id: "6", coefficient: 0.94, shortName: "Licencjat / wybrane zawody średnie", name: "Zawód medyczny z wymaganym wykształceniem wyższym I stopnia oraz wskazane zawody medyczne z wymaganym średnim wykształceniem" },
    { id: "7", coefficient: 0.86, shortName: "Inny zawód medyczny średni", name: "Inny pracownik wykonujący zawód medyczny z wymaganym średnim wykształceniem oraz opiekun medyczny" },
    { id: "8", coefficient: 1.00, shortName: "Działalność podstawowa — wyższe", name: "Pracownik działalności podstawowej, inny niż medyczny, z wymaganym wykształceniem wyższym" },
    { id: "9", coefficient: 0.78, shortName: "Działalność podstawowa — średnie", name: "Pracownik działalności podstawowej, inny niż medyczny, z wymaganym wykształceniem średnim" },
    { id: "10", coefficient: 0.65, shortName: "Działalność podstawowa — poniżej średniego", name: "Pracownik działalności podstawowej, inny niż medyczny, z wymaganym wykształceniem poniżej średniego" }
  ]
};

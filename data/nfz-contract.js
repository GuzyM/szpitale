window.NFZ_CONTRACT = {
  meta: {
    source: "API Umowy NFZ",
    sourceUrl: "https://api.nfz.gov.pl/",
    termsUrl: "https://api.nfz.gov.pl/app-umw-api/terms",
    apiVersion: "1.2",
    syncedAt: "2026-07-20T12:55:25+02:00",
    agreementUpdatedAt: "2026-07-16T19:00:52+02:00",
    year: 2026,
    branch: "06",
    agreementCode: "061/100014/SZP/08/2026",
    profileLabel: "Profil umowy 2026"
  },
  scopes: [
    {
      productCode: "03.4450.260.02",
      productName: "POŁOŻNICTWO I GINEKOLOGIA - HOSPITALIZACJA III POZIOM REFERENCYJNY - N01, N02, N03, N09, N11, N13, N20",
      averagePointPrice: 1.96,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      unitProducts: [
        { groupCode: "N01", productCode: "5.51.01.0013001", productName: "N01 PORÓD*", weight: 1 },
        { groupCode: "N02", productCode: "5.51.01.0013002", productName: "N02 PORÓD MNOGI LUB PRZEDWCZESNY*", weight: 1 },
        { groupCode: "N03", productCode: "5.51.01.0013003", productName: "N03 PATOLOGIA CIĄŻY LUB PŁODU Z PORODEM > 5 DNI*", weight: 1 },
        { groupCode: "N09", productCode: "5.51.01.0013009", productName: "N09 CIĘŻKA PATOLOGIA CIĄŻY Z PORODEM - DIAGNOSTYKA ROZSZERZONA, LECZENIE KOMPLEKSOWE > 6 DNI*", weight: 1 },
        { groupCode: "N11", productCode: "5.51.01.0013011", productName: "N11 CIĘŻKA PATOLOGIA CIĄŻY Z PORODEM - DIAGNOSTYKA ROZSZERZONA, LECZENIE KOMPLEKSOWE > 10 DNI Z PW*", weight: 1 },
        { groupCode: "N13", productCode: "5.51.01.0013037", productName: "N13 CIĘŻKA PATOLOGIA CIĄŻY ZAKOŃCZONA PORODEM ZABIEGOWYM > 3 DNI*", weight: 1 },
        { groupCode: "N20", productCode: "5.51.01.0013020", productName: "N20 NOWORODEK WYMAGAJĄCY NORMALNEJ OPIEKI", weight: 1 }
      ],
      additionalProducts: [
        {
          productCode: "5.53.01.0001510",
          productName: "KOSZTY DODATKOWE ZNIECZULENIA ZEWNĄTRZOPONOWEGO CIĄGŁEGO DO PORODU NIEZAWARTE W WARTOŚCI JGP",
          points: 600,
          applicableGroupCodes: ["N01", "N02", "N03", "N09", "N11", "N13"],
          note: "Produkt dostępny w zakresie. Rozliczenie wymaga spełnienia właściwych warunków NFZ."
        }
      ]
    }
  ]
};

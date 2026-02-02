mviewer.customLayers.museophile = (function () {
  const layerId = "museophile";
  const vectorSource = new ol.source.Vector();

  function getStyle(feature) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 4,
        fill: new ol.style.Fill({ color: "#a56697ff" }),
        stroke: new ol.style.Stroke({ color: "white", width: 1 }),
      }),
    });
  }

  const layer = new ol.layer.Vector({
    source: vectorSource,
    style: getStyle,
  });

  // let API_URL = "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/musees-de-france-base-museofile/records?limit=0&refine=region:%22Ile-de-France%22"

  // // 🔹 Récupération des données Museofile
  // fetch("https://data.culturecommunication.gouv.fr/api/explore/v2.1/catalog/datasets/musees-de-france-base-museofile/records?limit=100&refine=region:%22Ile-de-France%22")
  //   .then(response => response.json())
  //   .then(data => {

  //     console.log(data)

  //     data.results.forEach(musee => {

  //       // Vérification des coordonnées
  //       if (musee.coordonnees && musee.coordonnees.lon && musee.coordonnees.lat) {
  //         const feature = new ol.Feature({
  //           geometry: new ol.geom.Point(
  //             ol.proj.fromLonLat([
  //               musee.coordonnees.lon,
  //               musee.coordonnees.lat
  //             ])
  //           ),
  //           // todo à compléter
  //           nom: musee.nom_du_musee,
  //           commune: musee.commune,
  //         });
  //         vectorSource.addFeature(feature);
  //       }
  //     });
  //   })
  //   .catch(error => {
  //     console.error("Erreur API Museofile :", error);
  //   });

  //////////////////////////////

  async function chargerMusees() {
    const limit = 100;
    let offset = 0;
    let total = 0;

    do {
      const url = `https://data.culturecommunication.gouv.fr/api/explore/v2.1/catalog/datasets/musees-de-france-base-museofile/records?limit=${limit}&offset=${offset}&refine=region:%22Ile-de-France%22`;

      const response = await fetch(url);
      const data = await response.json();

      total = data.total_count;

      data.results.forEach((musee) => {
        if (musee.coordonnees?.lon && musee.coordonnees?.lat) {
          const feature = new ol.Feature({
            geometry: new ol.geom.Point(
              ol.proj.fromLonLat([musee.coordonnees.lon, musee.coordonnees.lat])
            ),
            identifiant: musee.identifiant,
            nom_officiel: musee.nom_officiel,
            adresse: musee.adresse,
            lieu: musee.lieu,
            code_postal: musee.code_postal,
            ville: musee.ville,
            region: musee.region,
            departement: musee.departement,
            url: musee.url,
            telephone: musee.telephone,
            categorie: musee.categorie,
            domaine_thematique: musee.domaine_thematique,
            histoire: musee.histoire,
            atout: musee.atout,
            themes: musee.themes,
            artiste: musee.artiste,
            personnage_phare: musee.personnage_phare,
            interet: musee.interet,
            protection_batiment: musee.protection_batiment,
            protection_espace: musee.protection_espace,
            refmer: musee.refmer,
            annee_creation: musee.annee_creation,
            date_de_mise_a_jour: musee.date_de_mise_a_jour,
          });
          vectorSource.addFeature(feature);
        }
      });
      offset += limit;
    } while (offset < total);
  }

  chargerMusees();

  // Légende
  let legend = {
    items: [
      {
        label: "Musées d’Île-de-France",
        color: "rgb(130, 207, 232)",
      },
    ],
  };

  new CustomLayer(layerId, layer, legend);

  return {
    museophile: layerId,
    layer: layer,
  };
})();

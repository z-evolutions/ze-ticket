"""
Elasticsearch-Suche für Tickets.
"""
from elasticsearch import AsyncElasticsearch
import logging

logger = logging.getLogger(__name__)

INDEX = "ze_tickets"

MAPPING = {
    "settings": {
        "analysis": {
            "analyzer": {
                "ze_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"]
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "ticket_number":        {"type": "keyword"},
            "subject":              {"type": "text", "analyzer": "ze_analyzer"},
            "description":          {"type": "text", "analyzer": "ze_analyzer"},
            "tags":                 {"type": "keyword"},
            "status":               {"type": "keyword"},
            "priority":             {"type": "keyword"},
            "channel":              {"type": "keyword"},
            "created_at":           {"type": "date"},
            "assigned_agent_name":  {"type": "text", "analyzer": "ze_analyzer"},
            "customer_name":        {"type": "text", "analyzer": "ze_analyzer"},
        }
    }
}


async def ensure_index(es: AsyncElasticsearch):
    try:
        exists = await es.indices.exists(index=INDEX)
        if not exists:
            await es.indices.create(index=INDEX, body=MAPPING)
            logger.info(f"ES-Index '{INDEX}' erstellt.")
    except Exception as e:
        logger.error(f"Fehler beim Erstellen des ES-Index: {e}")


async def index_ticket(es: AsyncElasticsearch, ticket) -> None:
    try:
        agent_name = None
        if hasattr(ticket, 'assigned_agent') and ticket.assigned_agent:
            agent_name = ticket.assigned_agent.display_name

        customer_name = None
        if hasattr(ticket, 'created_by') and ticket.created_by:
            customer_name = ticket.created_by.display_name

        doc = {
            "ticket_number":       ticket.ticket_number,
            "subject":             ticket.subject,
            "description":         ticket.description,
            "tags":                ticket.tags or [],
            "status":              ticket.status.value if hasattr(ticket.status, 'value') else ticket.status,
            "priority":            ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority,
            "channel":             ticket.channel.value if hasattr(ticket.channel, 'value') else ticket.channel,
            "created_at":          ticket.created_at.isoformat() if ticket.created_at else None,
            "assigned_agent_name": agent_name,
            "customer_name":       customer_name,
        }

        await es.index(index=INDEX, id=str(ticket.id), document=doc)
        logger.info(f"Ticket {ticket.ticket_number} indexiert.")
    except Exception as e:
        logger.error(f"Fehler beim Indexieren von Ticket {ticket.ticket_number}: {e}", exc_info=True)


async def delete_ticket_from_index(es: AsyncElasticsearch, ticket_id: str) -> None:
    try:
        await es.delete(index=INDEX, id=ticket_id, ignore=[404])
    except Exception as e:
        logger.error(f"Fehler beim Löschen aus ES-Index: {e}")


async def search_tickets(
    es: AsyncElasticsearch,
    query: str,
    status: str | None = None,
    priority: str | None = None,
    limit: int = 20,
) -> list[dict]:
    try:
        must = [
            {
                "multi_match": {
                    "query": query,
                    "fields": [
                        "subject^3",
                        "ticket_number^5",
                        "description",
                        "tags^2",
                        "assigned_agent_name",
                        "customer_name",
                    ],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            }
        ]

        filters = []
        if status:
            filters.append({"term": {"status": status}})
        if priority:
            filters.append({"term": {"priority": priority}})

        body = {
            "query": {
                "bool": {
                    "must": must,
                    "filter": filters,
                }
            },
            "size": limit,
            "highlight": {
                "fields": {
                    "subject":     {"number_of_fragments": 0},
                    "description": {"fragment_size": 150, "number_of_fragments": 1},
                },
                "pre_tags":  ["<em>"],
                "post_tags": ["</em>"],
            }
        }

        res = await es.search(index=INDEX, body=body)
        hits = res["hits"]["hits"]

        results = []
        for hit in hits:
            src = hit["_source"]
            src["id"] = hit["_id"]
            src["_score"] = hit["_score"]
            if "highlight" in hit:
                src["_highlight"] = hit["highlight"]
            results.append(src)

        return results

    except Exception as e:
        logger.error(f"ES-Suche fehlgeschlagen: {e}", exc_info=True)
        return []

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Poll({ postSlug }) {
  const [poll, setPoll] = useState(null);
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [animateResults, setAnimateResults] = useState(false);

  const getVoterId = () => {
    const key = "random-talk-voter-id";

    let voterId = localStorage.getItem(key);

    if (!voterId) {
      voterId = crypto.randomUUID();
      localStorage.setItem(key, voterId);
    }

    return voterId;
  };

  const loadPoll = async () => {
    try {
      setLoading(true);

      const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .select("*")
        .eq("post_slug", postSlug)
        .single();

      if (pollError) {
        console.error("Poll loading error:", pollError);
        setPoll(null);
        return;
      }

      setPoll(pollData);

      const { data: optionData, error: optionError } = await supabase
        .from("poll_options")
        .select("*")
        .eq("poll_id", pollData.id)
        .order("sort_order");

      if (optionError) {
        console.error("Poll options error:", optionError);
        return;
      }

      setOptions(optionData || []);

      const { data: voteData, error: voteError } = await supabase
        .from("poll_votes")
        .select("*")
        .eq("poll_id", pollData.id);

      if (voteError) {
        console.error("Poll votes error:", voteError);
        return;
      }

      const currentVotes = voteData || [];

      setVotes(currentVotes);

      const voterId = getVoterId();

      const myVote = currentVotes.find(
        (vote) => vote.voter_id === voterId
      );

      if (myVote) {
        setHasVoted(true);
        setSelectedOption(myVote.option_id);
      }
    } catch (error) {
      console.error("Poll error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoll();
  }, [postSlug]);

  useEffect(() => {
    if (!poll?.id) {
      return;
    }

    const channel = supabase
      .channel(`poll-${poll.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_votes",
          filter: `poll_id=eq.${poll.id}`,
        },
        () => {
          loadPoll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll?.id]);

  const handleSelect = (optionId) => {
    if (hasVoted || voting) {
      return;
    }

    setSelectedOption(optionId);
  };

  const handleVote = async () => {
    if (!selectedOption || !poll || hasVoted || voting) {
      return;
    }

    try {
      setVoting(true);

      const voterId = getVoterId();

      const { error } = await supabase
        .from("poll_votes")
        .insert({
          poll_id: poll.id,
          option_id: selectedOption,
          voter_id: voterId,
        });

      if (error) {
        console.error("Vote error:", error);

        if (error.code === "23505") {
          await loadPoll();
        }

        return;
      }

      setHasVoted(true);
      setAnimateResults(false);

      await loadPoll();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateResults(true);
        });
      });
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="poll-container mt-12">
        <div className="rounded-2xl border border-border/40 p-6">
          <div className="animate-pulse">
            <div className="h-5 w-2/3 rounded bg-muted" />

            <div className="mt-6 space-y-3">
              <div className="h-12 rounded-xl bg-muted" />
              <div className="h-12 rounded-xl bg-muted" />
              <div className="h-12 rounded-xl bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  const totalVotes = votes.length;

  const getVoteCount = (optionId) => {
    return votes.filter(
      (vote) => vote.option_id === optionId
    ).length;
  };

  const getPercentage = (optionId) => {
    if (totalVotes === 0) {
      return 0;
    }

    return Math.round(
      (getVoteCount(optionId) / totalVotes) * 100
    );
  };

  return (
    <section className="poll-container mt-12 border-t border-border/40 pt-8">
      <div className="rounded-2xl border border-border/60 bg-background p-5 shadow-sm sm:p-6">

        {/* Poll title */}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Poll
          </div>

          <h3 className="text-xl font-semibold leading-relaxed sm:text-2xl">
            {poll.question}
          </h3>
        </div>

        {/* Voting */}
        {!hasVoted && (
          <div className="mt-6 space-y-3">

            {options.map((option) => {
              const isSelected =
                selectedOption === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  disabled={voting}
                  aria-pressed={isSelected}
                  className={`group w-full rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-foreground bg-foreground/5 shadow-sm"
                      : "border-border/60 hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-muted/40"
                  } ${
                    voting
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3">

                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                        isSelected
                          ? "scale-110 border-foreground"
                          : "border-muted-foreground/40 group-hover:border-foreground/60"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-foreground transition-all duration-200 ${
                          isSelected
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0"
                        }`}
                      />
                    </span>

                    <span className="font-medium">
                      {option.option_text}
                    </span>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleVote}
              disabled={!selectedOption || voting}
              className="mt-4 w-full rounded-full bg-foreground px-5 py-3.5 font-medium text-background transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {voting ? "投票中…" : "投票"}
            </button>

            <p className="pt-1 text-center text-xs text-muted-foreground">
              每個瀏覽器只能投票一次
            </p>
          </div>
        )}

        {/* Results */}
        {hasVoted && (
          <div className="mt-6 space-y-5">

            {options.map((option) => {
              const percentage = getPercentage(option.id);
              const voteCount = getVoteCount(option.id);

              const isSelected =
                selectedOption === option.id;

              return (
                <div key={option.id}>

                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">
                        {option.option_text}
                      </span>

                      {isSelected && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          ✓ 你的選擇
                        </span>
                      )}
                    </div>

                    <span className="shrink-0 font-semibold">
                      {percentage}%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground transition-[width] duration-1000 ease-out"
                      style={{
                        width: animateResults
                          ? `${percentage}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {voteCount} 票
                  </div>
                </div>
              );
            })}

            <div className="border-t border-border/40 pt-4 text-sm text-muted-foreground">
              共 {totalVotes} 票 · 你已投票
            </div>
          </div>
        )}
      </div>
    </section>
  );
}